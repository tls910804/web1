import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { tt } from '../i18n';
import { Button, Chip } from '../components/Button';
import { Icon } from '../components/Icon';
import { Expr } from '../components/Rows';
import { WordChips } from '../components/WordChips';
import { allCats, countFeed, feedCards, allCards, tabList, videoCards } from '../lib/feed';
import { LEVELS } from '../constants';
import { preloadAudio } from '../lib/audio';
import { useActions } from '../lib/useActions';
import { langTag, sentence, trOf, langName, wordInfo } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';
import type { Card } from '../types';
import { AutoSheet, WordSheet } from './Sheets';
import { ShareSheet } from './Share';

let ytApi: Promise<void> | null = null;
const loadYT = () => (ytApi ||= new Promise<void>((res) => {
  if ((window as unknown as { YT?: { Player?: unknown } }).YT?.Player) return res();
  (window as unknown as { onYouTubeIframeAPIReady: () => void }).onYouTubeIframeAPIReady = res;
  const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
}));

type YTPlayer = { getCurrentTime: () => number; getPlayerState: () => number; playVideo: () => void; pauseVideo: () => void; seekTo: (s: number) => void; mute: () => void; destroy: () => void };

/** 유튜브 구간을 재생하고, 재생 중이면 지금 말하는 단어 번호를 알려준다 (멈추면 undefined). active면 처음부터 자동재생 */
export function VideoBlock({ video, active, onSpoken }: { video: NonNullable<Card['video']>; active: boolean; onSpoken: (i: number | undefined) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer>();
  const on = useRef(active);
  const play = () => {
    const p = player.current; if (!p) return;
    p.seekTo(video.start); p.playVideo();
    // 소리 있는 자동재생이 막히면 음소거로 다시 재생한다 (소리는 플레이어의 음소거 버튼으로 켠다)
    setTimeout(() => { if (on.current && p.getPlayerState() !== 1) { p.mute(); p.playVideo(); } }, 800);
  };
  useEffect(() => {
    on.current = active;
    if (active) play(); else player.current?.pauseVideo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  useEffect(() => {
    let t = 0, alive = true, last: number | undefined, made: YTPlayer | undefined;
    const emit = (i: number | undefined) => { if (i !== last) { last = i; onSpoken(i); } };
    loadYT().then(() => {
      if (!alive || !ref.current) return;
      const YT = (window as unknown as { YT: { Player: new (el: HTMLElement, o: object) => YTPlayer } }).YT;
      const p = made = new YT.Player(ref.current, {
        videoId: video.id, host: 'https://www.youtube-nocookie.com',
        playerVars: { start: video.start, end: video.end, playsinline: 1, rel: 0 },
        events: {
          onReady: () => { player.current = p; if (on.current) play(); },
          onStateChange: (e: { data: number }) => {
            clearInterval(t);
            if (e.data !== 1) return emit(undefined);
            t = window.setInterval(() => {
              const now = p.getCurrentTime();
              // 다시 재생하면 유튜브가 end를 무시해서 구간 끝에서 직접 멈춘다
              if (now >= video.end) { p.pauseVideo(); return; }
              emit((video.times || []).filter((s) => s <= now).length - 1);
            }, 100);
          },
        },
      });
    });
    return () => { alive = false; clearInterval(t); made?.destroy(); player.current = undefined; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);
  return <div className={video.full ? 'vfull' : 'vid'} style={video.ratio ? { '--ar': video.ratio } as React.CSSProperties : undefined}><div ref={ref} /></div>;
}

/** onlyVideo: 쇼츠 탭 — 같은 카드 화면에서 영상 카드만 보여준다 */
// overlay: 임시 시안 — 영상을 화면 가득, 자막을 영상 아래쪽에 겹쳐 보여 준다
export function Feed({ onlyVideo, overlay }: { onlyVideo?: boolean; overlay?: boolean } = {}) {
  const { state, set } = useStore();
  const ui = useUi();
  const { findSaved, saveItem, toggleSave } = useActions();
  const { cats, setCats, tab, setTab, toast, speak, openSheet, selection } = ui;

  const [vIndex, setVIndex] = useState(0); // 쇼츠 탭은 둘러보기와 위치를 따로 둔다
  const index = onlyVideo ? vIndex : ui.index, setIndex = onlyVideo ? setVIndex : ui.setIndex;

  const listRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef(0);
  const [spoken, setSpoken] = useState<{ id: string; i: number }>();
  const spokenOf = (c: Card) => (spoken?.id === c.id ? spoken.i : undefined);
  const onSpoken = (c: Card) => (i: number | undefined) => setSpoken(i === undefined ? undefined : { id: c.id, i });

  const catList = useMemo(() => allCats(state), [state]);
  const activeCats = useMemo(() => cats.filter((c) => catList.includes(c)), [cats, catList]);
  const tabs = useMemo(() => tabList(state), [state]);
  const activeTab = tabs.includes(tab) ? tab : '';
  const textCards = useMemo(() => feedCards(state, activeCats, activeTab), [state, activeCats, activeTab]);
  const vidCards = useMemo(() => videoCards(state), [state]);
  const cards = onlyVideo ? vidCards : textCards;
  const cur: Card | undefined = cards[Math.min(index, Math.max(cards.length - 1, 0))];
  const curId = cur?.id;

  // 목록이 바뀌면 현재 위치로 다시 스크롤한다
  const listKey = useMemo(() => cards.map((c) => c.id).join(), [cards]);
  const lo = Math.max(0, index - 3), hi = Math.min(cards.length, index + 4);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = Math.min(index, Math.max(cards.length - 1, 0)) * el.clientHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  // 자동재생: 카드가 바뀌거나 자동재생을 켜면 발음을 들려준다
  useEffect(() => {
    if (!state.auto || !cur || cur.video) return;
    const t = setTimeout(() => speak(sentence(cur), cur.lang, { repeat: state.autoRepeat, quiet: true }), 150); // 빠르게 여러 장 넘길 때 중간 카드는 안 읽게 짧게만 기다려요
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curId, state.auto, state.autoRepeat]);

  useEffect(() => {
    const next = cards[index + 1];
    if (next) preloadAudio(sentence(next), next.lang);
  }, [cards, index]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el || !el.clientHeight) return;
    const i = Math.round(el.scrollTop / el.clientHeight);
    if (i !== index) { setIndex(i); navigator.vibrate?.(6); }
  };

  // 카드 빈 곳을 두 번 탭하면 문장 저장
  const onListClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button,[data-action]')) return;
    const now = Date.now();
    if (now - lastTap.current < 320) {
      if (cur && !findSaved('s', cur)) saveItem('s', cur);
      else if (cur) toast(tt('이미 저장한 문장이에요'));
      lastTap.current = 0;
    } else lastTap.current = now;
  };

  const onWord = (card: Card, wi: number) => {
    if (!state.tapped) set({ tapped: true });
    const isExpr = wi < 0 || card.key.includes(wi);
    ui.setSelection({ cardId: card.id, set: isExpr ? card.key : [wi] });
    openSheet(<WordSheet card={card} wi={wi} />);
    if (!card.video) speak(wordInfo(card, wi, state.native).speak, card.lang, { quiet: true }); // 영상 카드는 영상 소리와 겹쳐서 안 읽어요
  };

  const copy = () => {
    if (!cur) return;
    if (navigator.clipboard) navigator.clipboard.writeText(sentence(cur)).then(() => toast(tt('문장을 복사했어요')), () => toast(tt('복사하지 못했어요')));
    else toast(tt('복사하지 못했어요'));
  };

  const [menu, setMenu] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const pickSpeed = (v: number, name: string) => {
    set({ speed: v }); setSpeedOpen(false);
    if (cur) speak(sentence(cur), cur.lang, { speed: v });
    toast(v === 1 ? tt('보통 속도로 들려줘요') : tt('{name}({v}×) 들려줘요', { name, v }));
  };
  const openFilter = () => setMenu(true);

  const hasCards = allCards(state).length > 0;
  const startStudy = (from: number) => {
    ui.setStudy({ queue: cards.slice(from).filter((c) => !c.video), feedIds: cards.map((c) => c.id) });
    ui.go('study');
  };
  const saved = !!(cur && findSaved('s', cur));

  // 위 탭: 문장 / 쇼츠 (개수를 같이 보여 줘서 무엇이 들어 있는지 알게)
  const modeSw = (
    <div className="mode-tabs">
      <button className={onlyVideo ? '' : 'on'} onClick={() => ui.go('feed')}><Icon name="copy" />{tt('문장')}<small>{textCards.length}</small></button>
      <button className={onlyVideo ? 'on sh' : ''} onClick={() => ui.go('shorts')}><Icon name="play" />{tt('쇼츠')}<small>{vidCards.length}</small></button>
    </div>
  );
  // 처음 한 번만: 문장 / 쇼츠가 무엇인지 알려 준다
  const [guide, setGuide] = useState(() => { try { return !onlyVideo && !localStorage.getItem('feed-guide'); } catch { return false; } });
  const closeGuide = () => { setGuide(false); try { localStorage.setItem('feed-guide', '1'); } catch { /* 다음에 또 보여도 괜찮음 */ } };

  return (
    <section className={`screen glow${cur?.video?.full || overlay ? ' on-video' : ''}${onlyVideo ? ' shorts' : ''}${overlay ? ' shorts2' : ''}`}>
      {index < cards.length - 1 && <div className="peek"><span>{tt('다음 문장')}</span></div>}
      <div className="feed" ref={listRef} onScroll={onScroll} onClick={onListClick}>
        {!cards.length ? (
          <div className="empty">
            <b style={{ color: 'var(--ink)', fontSize: 16 }}>{hasCards ? tt('조건에 맞는 문장이 없어요') : tt('아직 이 언어의 문장이 없어요')}</b>
            {hasCards ? tt("필터를 바꾸거나, '이미 알아요'로 숨긴 문장을 다시 볼 수 있어요.") : tt('다른 언어를 고르거나 배울래요 탭에서 직접 문장을 추가해 보세요.')}
            {hasCards && <Button kind="line" auto style={{ marginTop: 12, minHeight: 44, fontSize: 14 }} onClick={openFilter}>{tt('필터 열기')}</Button>}
          </div>
        ) : <>
          {/* 카드가 2,000장이 넘어서, 지금 카드 앞뒤 3장만 만들고 나머지는 위아래 빈 공간 하나씩으로 채워요 (스크롤 길이는 그대로) */}
          <div style={{ height: `${lo * 100}%` }} aria-hidden />
          {cards.slice(lo, hi).map((c, k) => { const i = lo + k; return (
          c.video?.full || (overlay && c.video) ? (
          <article className={`card full${c.id === curId ? ' cur' : ''}`} key={c.id}>
            <div className="card-body vcard">
              <VideoBlock video={overlay ? { ...c.video!, full: true } : c.video!} active={c.id === curId} onSpoken={onSpoken(c)} />
              <div className="vsub">
                <WordChips card={c} small selected={selection?.cardId === c.id ? selection.set : undefined} onWord={(wi) => onWord(c, wi)} spoken={spokenOf(c)} paged={!!c.video} />
                <p className={`tr${state.hideTr ? ' hide' : ''}`}>{trOf(c.tr, state.native)}</p>
              </div>
            </div>
          </article>
          ) : (
          <article className={`card${c.id === curId ? ' cur' : ''}`} key={c.id}>
            <div className={`card-body${c.video ? ' has-vid' : ''}`} onClick={(e) => { if (state.hideTr && (e.target as Element).closest('.tr,.expr')) e.currentTarget.querySelector('.tr')?.classList.toggle('hide'); }}>
              {!onlyVideo && <div className="band">
                <span>{tt(c.cat)} · {langName(c.lang)} · {i + 1} / {cards.length}</span>
                <button className={`auto-chip${state.auto ? ' on' : ''}`} aria-label={tt('자동재생')} onClick={() => openSheet(<AutoSheet />)}><Icon name="repeat" />{tt('자동')}</button>
              </div>}
              {i === 0 && !state.tapped && !onlyVideo && <span className="hint">{tt('단어를 눌러 보세요')}</span>}
              {c.video && <VideoBlock video={c.video} active={c.id === curId} onSpoken={onSpoken(c)} />}
              {onlyVideo && <div className="sh-meta"><span>{tt(c.cat)} · {langName(c.lang)}</span><span>{i + 1} / {cards.length}</span></div>}
              <WordChips card={c} selected={selection?.cardId === c.id ? selection.set : undefined} onWord={(wi) => onWord(c, wi)} spoken={spokenOf(c)} paged={!!c.video} />
              <p className={`tr${state.hideTr ? ' hide' : ''}`}>{trOf(c.tr, state.native)}</p>
              {c.expr && <><div className="divider" /><Expr lang={langTag(c.lang)} text={c.expr} mean={trOf(c.mean, state.native)} /></>}
              {!onlyVideo && <button className="study-btn" onClick={() => startStudy(i)}><i><svg viewBox="0 0 10 10"><path d="M1 0l8.5 5L1 10z" /></svg></i><span><b>{(() => { const n = Math.min(10, cards.slice(i).filter((x) => !x.video).length); return n === 10 ? tt('10문장 공부하기') : tt('{n}문장 공부하기', { n }); })()}</b><small>{tt('듣고 · 빈칸 채우기')}</small></span><svg className="arr" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>}
            </div>
          </article>
          )); })}
          <div style={{ height: `${(cards.length - hi) * 100}%` }} aria-hidden />
        </>}
      </div>

      {onlyVideo && <div className="feed-top sh">{modeSw}</div>}
      {!onlyVideo && <div className="feed-top">
        <div className="ft-row">
          {modeSw}
          <button className={`ft-btn${menu ? ' open' : ''}`} aria-expanded={menu} onClick={() => setMenu(!menu)}>
            {EMOJI[activeTab || '전체']} {tt(activeTab || '전체')}{state.level !== '전체' && ` · ${tt(state.level)}`}{activeCats.length > 0 && ` +${activeCats.length}`}<Icon name="chev" />
          </button>
        </div>
      </div>}
      {menu && <FilterMenu tabs={tabs} tab={activeTab} cats={activeCats} onClose={() => setMenu(false)}
        onApply={(level, t, picked) => { set({ level }); setTab(t); setCats(picked); setIndex(0); setMenu(false); }} />}

      {guide && (
        <div className="feed-guide" onClick={closeGuide}>
          <div className="tip" onClick={(e) => e.stopPropagation()}>
            <b>{tt('둘러보기는 두 가지예요')}</b>
            <p><i className="t"><Icon name="copy" /></i><span><b>{tt('문장')}</b><small>{tt('한 문장씩 카드로 · 모든 언어')}</small></span></p>
            <p><i className="v"><Icon name="play" /></i><span><b>{tt('쇼츠')}</b><small>{tt('영상 속 장면으로 · 지금은 영어만')}</small></span></p>
            <button onClick={closeGuide}>{tt('알겠어요')}</button>
          </div>
        </div>
      )}

      {cards.length > 0 && (
        <div className="acts">
          <button key={saved ? 'on' : 'off'} className={`act${saved ? ' on pop' : ''}`} aria-label={tt('배울 문장으로 저장')} onClick={() => cur && toggleSave('s', cur)}><Icon name="mark" /></button>
          <button className="act" aria-label={tt('발음 듣기')} onClick={() => cur && speak(sentence(cur), cur.lang)}><Icon name="speak" /></button>
          <div className="spd-wrap">
            <button className={`act spd${state.speed < 1 ? ' on' : ''}`} aria-label={tt('듣기 속도')} aria-expanded={speedOpen} onClick={() => setSpeedOpen(!speedOpen)}>{state.speed}×</button>
            {speedOpen && (
              <div className="spd-pop" role="menu">
                <b>{tt('듣기 속도')}</b>
                {([[1, '보통'], [0.8, '조금 느리게'], [0.6, '느리게']] as const).map(([v, n]) => (
                  <button key={v} role="menuitemradio" aria-checked={state.speed === v} className={state.speed === v ? 'on' : ''} onClick={() => pickSpeed(v, tt(n))}><i>{v}×</i>{tt(n)}</button>
                ))}
              </div>
            )}
          </div>
          <button className={`act${state.hideTr ? ' off' : ''}`} aria-label={tt('해석 가리기')} onClick={() => set({ hideTr: !state.hideTr })}><Icon name={state.hideTr ? 'eyeOff' : 'eye'} /></button>
          <button className="act" aria-label={tt('문장 복사')} onClick={copy}><Icon name="copy" /></button>
          <button className="act" aria-label={tt('공유 카드 만들기')} onClick={() => cur && openSheet(<ShareSheet card={cur} />)}><Icon name="share" /></button>
        </div>
      )}
    </section>
  );
}


const EMOJI: Record<string, string> = { 전체: '🌐', 일상: '🏠', 슬랭: '😎', '일·업무': '💼', 여행: '✈️', 연애: '💕', '드라마·영화': '🎬', 감정: '💛', '카페·식당': '☕', 회사: '🏢', '내 문장': '✏️' };
const LV_HINT: Record<string, string> = { 전체: '모든 난이도', 초급: '짧고 자주 쓰는 말', 중급: '관용 표현', 고급: '긴 문장과 뉘앙스' };

/** 둘러보기 필터: 위 버튼 바로 아래로 펼친다. 난이도 한 개 · 상황 한 개 · 세부 주제 여러 개 */
function FilterMenu({ tabs, tab, cats, onApply, onClose }: { tabs: string[]; tab: string; cats: string[]; onApply: (level: string, tab: string, cats: string[]) => void; onClose: () => void }) {
  const { state, set } = useStore();
  const { toast } = useUi();
  const [lv, setLv] = useState(state.level);
  const [t, setT] = useState(tab);
  const [picked, setPicked] = useState(cats);
  const catList = allCats(state);
  const n = countFeed(state, lv, picked, t);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  const toggle = (c: string) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  return (
    <>
      <div className="fmenu-bg" onClick={onClose} />
      <div className="fmenu" role="dialog" aria-label={tt('필터')}>
        <p className="fm-lb">{tt('난이도')}</p>
        <div className="fm-seg">
          {LEVELS.map((l, i) => (
            <button key={l} className={lv === l ? 'on' : ''} aria-pressed={lv === l} onClick={() => setLv(l)}>
              {tt(l)}<span className="fm-bars" aria-hidden>{[1, 2, 3].map((k) => <i key={k} className={k <= i ? 'f' : ''} />)}</span>
            </button>
          ))}
        </div>
        <p className="fm-hint">{tt(LV_HINT[lv] ?? '')}</p>
        <div className="fm-hr" />
        <p className="fm-lb">{tt('상황')}</p>
        <div className="fm-chips">
          {['', ...tabs].map((x) => <Chip key={x} on={t === x} onClick={() => setT(x)}>{EMOJI[x || '전체']} {tt(x || '전체')}</Chip>)}
        </div>
        {catList.length > 0 && <>
          <p className="fm-lb">{tt('세부 주제')}<small>{tt('여러 개 고를 수 있어요')}</small></p>
          <div className="fm-chips">
            {catList.map((c) => <Chip key={c} on={picked.includes(c)} onClick={() => toggle(c)}>{EMOJI[c] ? `${EMOJI[c]} ` : ''}{tt(c)}</Chip>)}
          </div>
        </>}
        {state.known.length > 0 && (
          <button className="fm-known" onClick={() => { const k = state.known.length; set({ known: [] }); toast(tt('숨긴 문장 {n}개를 다시 보여줘요', { n: k })); onClose(); }}>
            {tt('\'이미 알아요\'로 숨긴 문장 {n}개', { n: state.known.length })}<b>{tt('다시 보기')}</b>
          </button>
        )}
        <div className="fm-go"><Button kind="dark" disabled={!n} onClick={() => onApply(lv, t, picked)}>{n ? tt('{n}개 문장 보기', { n }) : tt('맞는 문장이 없어요')}</Button></div>
      </div>
    </>
  );
}
