import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { tt } from '../i18n';
import { Button, Chip, IconButton } from '../components/Button';
import { Icon } from '../components/Icon';
import { Expr } from '../components/Rows';
import { WordChips } from '../components/WordChips';
import { allCats, feedCards, allCards, tabList, videoCards } from '../lib/feed';
import { preloadAudio } from '../lib/audio';
import { useActions } from '../lib/useActions';
import { lang, langTag, sentence, trOf } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';
import type { Card } from '../types';
import { AutoSheet, FilterSheet, WordSheet } from './Sheets';

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
export function Feed({ onlyVideo }: { onlyVideo?: boolean } = {}) {
  const { state, set } = useStore();
  const ui = useUi();
  const { findSaved, saveItem, toggleSave } = useActions();
  const { cats, setCats, tab, setTab, toast, speak, openSheet, closeLayer, selection } = ui;

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
  const cards = useMemo(() => (onlyVideo ? videoCards(state) : feedCards(state, activeCats, activeTab)), [state, activeCats, activeTab, onlyVideo]);
  const cur: Card | undefined = cards[Math.min(index, Math.max(cards.length - 1, 0))];
  const curId = cur?.id;

  // 목록이 바뀌면 현재 위치로 다시 스크롤한다
  const listKey = cards.map((c) => c.id).join();
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = Math.min(index, Math.max(cards.length - 1, 0)) * el.clientHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  // 자동재생: 카드가 바뀌거나 자동재생을 켜면 발음을 들려준다
  useEffect(() => {
    if (!state.auto || !cur || cur.video) return;
    const t = setTimeout(() => speak(sentence(cur), cur.lang, { repeat: state.autoRepeat, quiet: true }), 450);
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
  };

  const copy = () => {
    if (!cur) return;
    if (navigator.clipboard) navigator.clipboard.writeText(sentence(cur)).then(() => toast(tt('문장을 복사했어요')), () => toast(tt('복사하지 못했어요')));
    else toast(tt('복사하지 못했어요'));
  };

  const openFilter = () => openSheet(
    <FilterSheet cats={activeCats} tab={activeTab} onApply={(level, picked) => { set({ level }); setCats(picked); setIndex(0); closeLayer(); }} />,
  );

  const hasCards = allCards(state).length > 0;
  const startStudy = (from: number) => {
    ui.setStudy({ queue: cards.slice(from).filter((c) => !c.video), feedIds: cards.map((c) => c.id) });
    ui.go('study');
  };
  const saved = !!(cur && findSaved('s', cur));

  // 쇼츠는 따로 탭이 아니라 둘러보기 안의 "영상" 보기
  const modeSw = (
    <div className="mode-sw">
      <button className={onlyVideo ? '' : 'on'} onClick={() => ui.go('feed')}><Icon name="mark" />{tt('카드')}</button>
      <button className={onlyVideo ? 'on' : ''} onClick={() => ui.go('shorts')}><Icon name="play" />{tt('영상')}</button>
    </div>
  );
  return (
    <section className={`screen glow${cur?.video?.full ? ' on-video' : ''}${onlyVideo ? ' shorts' : ''}`}>
      {index < cards.length - 1 && <div className="peek"><span>{tt('다음 문장')}</span></div>}
      <div className="feed" ref={listRef} onScroll={onScroll} onClick={onListClick}>
        {!cards.length ? (
          <div className="empty">
            <b style={{ color: 'var(--ink)', fontSize: 16 }}>{hasCards ? tt('조건에 맞는 문장이 없어요') : tt('아직 이 언어의 문장이 없어요')}</b>
            {hasCards ? tt("필터를 바꾸거나, '이미 알아요'로 숨긴 문장을 다시 볼 수 있어요.") : tt('다른 언어를 고르거나 배울래요 탭에서 직접 문장을 추가해 보세요.')}
            {hasCards && <Button kind="line" auto style={{ marginTop: 12, minHeight: 44, fontSize: 14 }} onClick={openFilter}>{tt('필터 열기')}</Button>}
          </div>
        ) : cards.map((c, i) => (
          c.video?.full ? (
          <article className={`card full${c.id === curId ? ' cur' : ''}`} key={c.id}>
            <div className="card-body vcard">
              <VideoBlock video={c.video} active={c.id === curId} onSpoken={onSpoken(c)} />
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
                <span>{tt(c.cat)} · {lang(c.lang).name} · {i + 1} / {cards.length}</span>
                <button className={`auto-chip${state.auto ? ' on' : ''}`} aria-label={tt('자동재생')} onClick={() => openSheet(<AutoSheet />)}><Icon name="repeat" />{tt('자동')}</button>
              </div>}
              {i === 0 && !state.tapped && !onlyVideo && <span className="hint">{tt('단어를 눌러 보세요')}</span>}
              {c.video && <VideoBlock video={c.video} active={c.id === curId} onSpoken={onSpoken(c)} />}
              {onlyVideo && <div className="sh-meta"><span>{tt(c.cat)} · {lang(c.lang).name}</span><span>{i + 1} / {cards.length}</span></div>}
              <WordChips card={c} selected={selection?.cardId === c.id ? selection.set : undefined} onWord={(wi) => onWord(c, wi)} spoken={spokenOf(c)} paged={!!c.video} />
              <p className={`tr${state.hideTr ? ' hide' : ''}`}>{trOf(c.tr, state.native)}</p>
              {c.expr && <><div className="divider" /><Expr lang={langTag(c.lang)} text={c.expr} mean={trOf(c.mean, state.native)} /></>}
              {!onlyVideo && <button className="study-btn" onClick={() => startStudy(i)}><i><svg viewBox="0 0 10 10"><path d="M1 0l8.5 5L1 10z" /></svg></i>{tt('10문장 공부하기')}</button>}
            </div>
          </article>
          )
        ))}
      </div>

      {onlyVideo && <div className="feed-top sh">{modeSw}</div>}
      {!onlyVideo && <div className="feed-top">
        <div className="ft-row">
          {modeSw}
          <IconButton label={tt('필터')} extra="filter-btn" onClick={openFilter}>
            <Icon name="filter" />{(state.level !== '전체' || activeCats.length > 1) && <span className="dot" />}
          </IconButton>
        </div>
        <div className="cats">
          <Chip on={!activeTab} onClick={() => { setTab(''); setIndex(0); }}>{tt('전체')}</Chip>
          {tabs.map((t) => <Chip key={t} on={activeTab === t} onClick={() => { setTab(t); setIndex(0); }}>{tt(t)}</Chip>)}
        </div>
      </div>}

      {cards.length > 0 && (
        <div className="acts">
          <button key={saved ? 'on' : 'off'} className={`act${saved ? ' on pop' : ''}`} aria-label={tt('배울 문장으로 저장')} onClick={() => cur && toggleSave('s', cur)}><Icon name="mark" /></button>
          <button className="act" aria-label={tt('발음 듣기')} onClick={() => cur && speak(sentence(cur), cur.lang)}><Icon name="speak" /></button>
          <button className="act" aria-label={tt('느리게 듣기')} onClick={() => cur && speak(sentence(cur), cur.lang, { rate: 0.55 })}><Icon name="clock" /></button>
          <button className={`act${state.hideTr ? ' off' : ''}`} aria-label={tt('해석 가리기')} onClick={() => set({ hideTr: !state.hideTr })}><Icon name={state.hideTr ? 'eyeOff' : 'eye'} /></button>
          <button className="act" aria-label={tt('문장 복사')} onClick={copy}><Icon name="copy" /></button>
        </div>
      )}
    </section>
  );
}

