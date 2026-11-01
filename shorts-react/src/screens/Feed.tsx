import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Button, Chip, IconButton } from '../components/Button';
import { Icon } from '../components/Icon';
import { Expr } from '../components/Rows';
import { WordChips } from '../components/WordChips';
import { allCats, feedCards, allCards } from '../lib/feed';
import { preloadAudio } from '../lib/audio';
import { useActions } from '../lib/useActions';
import { lang, sentence, trOf } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';
import type { Card } from '../types';
import { AutoSheet, FilterSheet, WordSheet } from './Sheets';

export function Feed() {
  const { state, set } = useStore();
  const ui = useUi();
  const { findSaved, saveItem, toggleSave } = useActions();
  const { cats, setCats, index, setIndex, toast, speak, openSheet, closeLayer, selection } = ui;

  const listRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef(0);

  const catList = useMemo(() => allCats(state), [state]);
  const activeCats = useMemo(() => cats.filter((c) => catList.includes(c)), [cats, catList]);
  const cards = useMemo(() => feedCards(state, activeCats), [state, activeCats]);
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
    if (!state.auto || !cur) return;
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
      else if (cur) toast('이미 저장한 문장이에요');
      lastTap.current = 0;
    } else lastTap.current = now;
  };

  const onWord = (card: Card, wi: number) => {
    if (!state.tapped) set({ tapped: true });
    const isExpr = wi < 0 || card.key.includes(wi);
    ui.setSelection({ cardId: card.id, set: isExpr ? card.key : [wi] });
    openSheet(<WordSheet card={card} wi={wi} />);
  };

  const markKnown = () => {
    if (!cur) return;
    const id = cur.id;
    set((s) => ({ known: [...s.known, id] }));
    toast('이 문장은 다시 보여주지 않아요', '되돌리기', () => set((s) => ({ known: s.known.filter((k) => k !== id) })));
  };

  const copy = () => {
    if (!cur) return;
    if (navigator.clipboard) navigator.clipboard.writeText(sentence(cur)).then(() => toast('문장을 복사했어요'), () => toast('복사하지 못했어요'));
    else toast('복사하지 못했어요');
  };

  const openFilter = () => openSheet(
    <FilterSheet cats={activeCats} onApply={(level, picked) => { set({ level }); setCats(picked); setIndex(0); closeLayer(); }} />,
  );

  const hasCards = allCards(state).length > 0;
  const saved = !!(cur && findSaved('s', cur));
  const shown = Math.min(index, Math.max(cards.length - 1, 0));

  return (
    <section className="screen glow">
      <div className="feed" ref={listRef} onScroll={onScroll} onClick={onListClick}>
        {!cards.length ? (
          <div className="empty">
            <b style={{ color: 'var(--ink)', fontSize: 16 }}>{hasCards ? '조건에 맞는 문장이 없어요' : '아직 이 언어의 문장이 없어요'}</b>
            {hasCards ? "필터를 바꾸거나, '이미 알아요'로 숨긴 문장을 다시 볼 수 있어요." : '다른 언어를 고르거나 배울래요 탭에서 직접 문장을 추가해 보세요.'}
            {hasCards && <Button kind="line" auto style={{ marginTop: 12, minHeight: 44, fontSize: 14 }} onClick={openFilter}>필터 열기</Button>}
          </div>
        ) : cards.map((c, i) => (
          <article className={`card${c.id === curId ? ' cur' : ''}`} key={c.id}>
            <div className="card-body">
              {i === 0 && !state.tapped && <span className="hint">단어를 눌러 보세요</span>}
              <WordChips card={c} selected={selection?.cardId === c.id ? selection.set : undefined} onWord={(wi) => onWord(c, wi)} />
              <p className={`tr${state.hideTr ? ' hide' : ''}`} onClick={(e) => { if (state.hideTr) e.currentTarget.classList.toggle('hide'); }}>{trOf(c.tr, state.native)}</p>
              {c.expr && <><div className="divider" /><Expr text={c.expr} mean={trOf(c.mean, state.native)} /></>}
            </div>
          </article>
        ))}
      </div>

      <div className="feed-top">
        <div className="cats">
          <Chip on={!activeCats.length} onClick={() => { setCats([]); setIndex(0); }}>전체</Chip>
          {catList.map((c) => <Chip key={c} on={activeCats.includes(c)} onClick={() => { setCats([c]); setIndex(0); }}>{c}</Chip>)}
        </div>
        <IconButton label="필터" extra="filter-btn" onClick={openFilter}>
          <Icon name="filter" />{(state.level !== '전체' || activeCats.length > 1) && <span className="dot" />}
        </IconButton>
      </div>

      <div className="feed-head">
        <button className={`auto-chip${state.auto ? ' on' : ''}`} onClick={() => openSheet(<AutoSheet />)}><Icon name="repeat" />자동재생</button>
        <div className="info">
          {cur && <>{cur.cat}<span className="pill">{lang(cur.lang).name}</span><span className="cnt">{shown + 1} / {cards.length}</span></>}
        </div>
      </div>

      {cards.length > 0 && (
        <div className="acts">
          <button key={saved ? 'on' : 'off'} className={`act${saved ? ' on pop' : ''}`} aria-label="배울 문장으로 저장" onClick={() => cur && toggleSave('s', cur)}><Icon name="mark" />배울래요</button>
          <button className="act" aria-label="발음 듣기" onClick={() => cur && speak(sentence(cur), cur.lang)}><Icon name="speak" />듣기</button>
          <button className="act" aria-label="느리게 듣기" onClick={() => cur && speak(sentence(cur), cur.lang, { rate: 0.55 })}><Icon name="clock" />느리게</button>
          <button className="act" aria-label="이미 알아요, 다시 보지 않기" onClick={markKnown}><Icon name="skip" />이미 알아요</button>
          <button className={`act${state.hideTr ? ' on' : ''}`} aria-label="해석 가리기" onClick={() => set({ hideTr: !state.hideTr })}><Icon name="eye" /><span>{state.hideTr ? '해석 보기' : '해석 가림'}</span></button>
          <button className="act" aria-label="문장 복사" onClick={copy}><Icon name="copy" />복사</button>
        </div>
      )}
      {state.tapped && <div className="swipe">위로 넘기기 · 두 번 탭해서 문장 저장</div>}
    </section>
  );
}

