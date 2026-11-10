import { useRef, useState } from 'react';
import { tt } from '../i18n';
import { VideoBlock } from './Feed';
import { Button, Chip, IconButton } from '../components/Button';
import { Icon } from '../components/Icon';
import { Grab, SheetHead } from '../components/Layer';
import { Expr, Pill } from '../components/Rows';
import { DAY } from '../constants';
import { daysLabel, dueItems, isWeak, minutesFor, nextDueText, retryItems, todayCount, weakInToday, weakItems, WEAK_AT } from '../lib/srs';
import { useActions } from '../lib/useActions';
import { lang, langTag, sentence, startOfDay, trOf, wordInfo } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';
import { RetryBar, useNow } from './Review';
import type { SavedItem } from '../types';

const dueIn = (x: SavedItem) => Math.max(0, Math.floor((x.due - startOfDay(Date.now())) / DAY));

export function Saved() {
  const { state, set } = useStore();
  const { go, savedTab, setSavedTab, savedFilter, setSavedFilter, speak, toast, openSheet, closeLayer } = useUi();
  const { removeItem, startToday, startReview } = useActions();
  const [q, setQ] = useState<string | null>(null);
  const [byRecent, setByRecent] = useState(false);
  const [sel, setSel] = useState<string[] | null>(null);
  const timer = useRef<number>();
  const longed = useRef(false);
  const now = useNow(retryItems(state).length > 0);
  const retry = retryItems(state, now);

  const head = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 12px' }}>
      <h2 className="title" style={{ margin: 0 }}>{tt('배울래요')}</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <IconButton label={tt('검색')} style={{ width: 38, height: 38 }} onClick={() => setQ(q === null ? '' : null)}><Icon name="search" /></IconButton>
        <button className="add-btn" onClick={() => go('add')}><Icon name="plus" style={{ width: 16, height: 16, strokeWidth: 2.2 }} />{tt('문장 추가')}</button>
      </div>
    </div>
  );

  if (!state.saved.length) {
    return (
      <section className="screen"><div className="page">
        {head}
        <div className="empty-state">
          <div className="em-ico"><Icon name="mark" /></div>
          <b>{tt('아직 저장한 문장이 없어요')}</b>
          <p>{tt('둘러보기에서 단어를 누르거나 카드를 두 번 탭해서')}<br />{tt('마음에 드는 문장을 저장해 보세요.')}</p>
          <Button kind="dark" onClick={() => go('feed')}>{tt('둘러보러 가기')}</Button>
          <Button kind="link" onClick={() => go('add')}>{tt('직접 문장 추가하기')}</Button>
        </div>
      </div></section>
    );
  }

  const due = todayCount(state);
  const weakToday = weakInToday(state);
  const dueIds = new Set(dueItems(state).slice(0, state.daily).map((x) => x.id));
  const ofKind = state.saved.filter((x) => x.kind === savedTab);
  const learning = ofKind.filter((x) => !x.learned);
  const learned = ofKind.filter((x) => x.learned);
  const countS = state.saved.filter((x) => x.kind === 's').length;
  const countW = state.saved.length - countS;
  const waiting = dueItems(state).length - due;
  const text = (x: SavedItem) => {
    const info = x.kind === 'w' ? wordInfo(x.card, x.wi, state.native) : null;
    return { head: info ? info.text : sentence(x.card), sub: info ? (info.mean || sentence(x.card)) : trOf(x.card.tr, state.native), say: info ? info.speak : sentence(x.card) };
  };
  let list = savedFilter === 'learning' ? learning : learned;
  const needle = (q || '').trim().toLowerCase();
  if (needle) list = list.filter((x) => { const t = text(x); return (t.head + t.sub).toLowerCase().includes(needle); });
  list = [...list].sort((a, b) => (byRecent ? b.at - a.at : a.due - b.due));

  const patch = (ids: string[], f: (x: SavedItem) => Partial<SavedItem>) =>
    set((s) => ({ saved: s.saved.map((y) => (ids.includes(y.id) ? { ...y, ...f(y) } : y)) }));
  const toggleLearned = (x: SavedItem) => patch([x.id], (y) => ({ learned: !y.learned, due: y.learned ? Date.now() : y.due }));
  const remove = (id: string) => {
    const idx = state.saved.findIndex((x) => x.id === id);
    const gone = state.saved[idx];
    removeItem(id);
    if (gone) toast(tt('삭제했어요'), tt('되돌리기'), () => set((s) => {
      const next = [...s.saved];
      next.splice(Math.min(idx, next.length), 0, gone);
      return { saved: next };
    }));
  };

  const openStart = () => {
    if (!weakToday) return startToday(state);
    const Pick = () => {
      const [weakOnly, setWeakOnly] = useState(false);
      const opt = (title: string, sub: string, w: boolean) => (
        <button className={`radio${weakOnly === w ? ' on' : ''}`} onClick={() => setWeakOnly(w)} aria-pressed={weakOnly === w}>
          <i /><span><b>{title}</b><small>{sub}</small></span>
        </button>
      );
      return (
        <>
          <Grab />
          <h3>{tt('어떤 문장을 복습할까요?')}</h3>
          {opt(tt('오늘 복습 전체 · {n}개', { n: due }), tt('약 {m}분', { m: minutesFor(due) }), false)}
          {opt(tt('약점만 · {n}개', { n: weakItems(state).length }), tt('\'다시\'를 {w}번 이상 받은 문장 · 약 {m}분', { w: WEAK_AT, m: minutesFor(weakItems(state).length) }), true)}
          <Button onClick={() => { closeLayer(); startToday(state, weakOnly); }}>{tt('복습 시작')}</Button>
        </>
      );
    };
    openSheet(<Pick />);
  };

  const openDetail = (x: SavedItem) => {
    const t = text(x);
    const next = x.learned ? tt('외웠어요') : dueIn(x) ? daysLabel(dueIn(x)) : tt('오늘');
    openSheet(
      <>
        <SheetHead title={tt('문장 상세')} />
        <div className="det-s">{t.head}</div>
        <div className="det-k">{t.sub}</div>
        {x.kind === 's' && x.card.expr && <div className="det-expr"><Expr lang={langTag(x.card.lang)} text={x.card.expr} mean={trOf(x.card.mean, state.native)} /></div>}
        <div className="det-act">
          <button className="chip" onClick={() => speak(t.say, x.card.lang)}><Icon name="speak" />{tt('듣기')}</button>
          <button className="chip" onClick={() => speak(t.say, x.card.lang, { rate: 0.7 })}><Icon name="clock" />{tt('느리게')}</button>
        </div>
        <div className="det-tiles">
          <div className="det-tile"><b>{new Date(x.at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</b><span>{tt('저장한 날')}</span></div>
          <div className="det-tile hi"><b>{next}</b><span>{tt('다음 복습')}</span></div>
        </div>
        <label className="det-memo-l"><span>{tt('메모')}</span>
          <input className="det-memo" placeholder={tt('메모를 남겨 보세요')} defaultValue={x.note || ''} maxLength={120}
            onBlur={(e) => patch([x.id], () => ({ note: e.target.value.trim() || undefined }))} />
        </label>
        <Button onClick={() => { closeLayer(); startReview([x.id]); }}>{tt('이 문장만 복습')}</Button>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button kind="light" onClick={() => { toggleLearned(x); closeLayer(); }}>{x.learned ? tt('다시 외우기') : tt('외웠어요')}</Button>
          <Button kind="light" style={{ color: 'var(--danger)' }} onClick={() => { closeLayer(); remove(x.id); }}>{tt('삭제')}</Button>
        </div>
      </>,
    );
  };

  const press = (x: SavedItem) => ({
    onPointerDown: () => { longed.current = false; timer.current = window.setTimeout(() => { longed.current = true; navigator.vibrate?.(10); setSel([x.id]); }, 450); },
    onPointerUp: () => clearTimeout(timer.current),
    onPointerLeave: () => clearTimeout(timer.current),
    onPointerMove: () => clearTimeout(timer.current),
    onClick: () => {
      if (longed.current) { longed.current = false; return; }
      if (sel) setSel(sel.includes(x.id) ? sel.filter((i) => i !== x.id) : [...sel, x.id]);
      else openDetail(x);
    },
  });

  const bulk = (f: () => void) => { f(); setSel(null); };

  return (
    <section className="screen"><div className="page" style={{ paddingTop: 12, ...(sel ? { paddingBottom: 150 } : {}) }}>
      {sel ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 12px' }}>
          <Button kind="link" auto onClick={() => setSel(null)}>{tt('취소')}</Button>
          <b>{tt('{n}개 선택', { n: sel.length })}</b>
          <Button kind="link" auto onClick={() => setSel(sel.length === list.length ? [] : list.map((x) => x.id))}>{tt('전체 선택')}</Button>
        </div>
      ) : head}
      {q !== null && !sel && <input className="det-memo" autoFocus placeholder={tt('문장 · 뜻 검색')} value={q} onChange={(e) => setQ(e.target.value)} />}
      {!sel && (
        <div className="review-banner">
          <span className="rb-n">{due}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{due ? tt('오늘 복습할 문장') : tt('오늘 복습은 끝났어요')}</b>
            <span>{due ? (weakToday ? tt('약점 {w}개 포함 · 약 {m}분', { w: weakToday, m: minutesFor(due) }) : waiting > 0 ? tt('하루 {d}개씩 · {w}개는 다음에', { d: state.daily, w: waiting }) : tt('약 {m}분', { m: minutesFor(due) })) : (nextDueText(state) || tt('새로 저장하면 복습할 수 있어요'))}</span>
          </div>
          <Button auto disabled={!due} style={{ minHeight: 41, padding: '12px 16px', fontSize: 14, borderRadius: 8, background: 'var(--blue)', color: '#fff' }} onClick={openStart}>{tt('복습 시작')}</Button>
        </div>
      )}
      {!sel && <RetryBar label={tt('5분 뒤 다시 볼 문장 {n}개', { n: retry.length })} items={retry} now={now} />}
      <div className="seg">
        <button className={savedTab === 's' ? 'on' : ''} onClick={() => setSavedTab('s')}>{tt('문장')}<small>{countS}</small></button>
        <button className={savedTab === 'w' ? 'on' : ''} onClick={() => setSavedTab('w')}>{tt('단어·표현')}<small>{countW}</small></button>
      </div>
      <div className="grid" style={{ marginBottom: 14, alignItems: 'center' }}>
        <Chip on={savedFilter === 'learning'} onClick={() => setSavedFilter('learning')}>{tt('외우는 중')}</Chip>
        <Chip on={savedFilter === 'learned'} onClick={() => setSavedFilter('learned')}>{tt('외웠어요')}</Chip>
        <button className="sort" onClick={() => setByRecent(!byRecent)}>{byRecent ? tt('최근 순') : tt('복습 순')} ▾</button>
      </div>
      {list.length ? list.map((x) => {
        const t = text(x);
        const d = dueIn(x);
        const badge = !x.learned && isWeak(x) ? <span className="bdg2 weak">{tt('약점 ×{n}', { n: x.lapses ?? 0 })}</span> : null;
        const on = sel?.includes(x.id);
        return (
          <div className={`item${on ? ' sel' : ''}`} key={x.id} {...press(x)}>
            {sel && <i className={`chk${on ? ' on' : ''}`} />}
            <div className="tags"><Pill>{lang(x.card.lang).name}</Pill>{badge}</div>
            {x.card.video && <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}><VideoBlock video={x.card.video} active={false} onSpoken={() => {}} /></div>}
            <div className="en" lang={langTag(x.card.lang)}>{t.head}</div>
            <div className="ko">{t.sub}</div>
            <div className="row2">
              <span className="nx">{x.learned ? tt('외웠어요') : tt('다음 복습 · {w}', { w: dueIds.has(x.id) ? tt('오늘') : daysLabel(d) })}</span>
              {!sel && (
              <div className="btns" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                <IconButton label={tt('발음 듣기')} onClick={() => speak(t.say, x.card.lang)}><Icon name="speak" /></IconButton>
                <IconButton label={x.learned ? tt('다시 외우기') : tt('외웠어요')} style={x.learned ? { background: 'var(--blue-soft)' } : undefined} onClick={() => toggleLearned(x)}>
                  <Icon name="check" style={x.learned ? { stroke: 'var(--blue)' } : undefined} />
                </IconButton>
                <IconButton label={tt('삭제')} onClick={() => remove(x.id)}><Icon name="close" /></IconButton>
              </div>
              )}
            </div>
          </div>
        );
      }) : (
        <p className="desc" style={{ padding: '24px 0', textAlign: 'center' }}>
          {needle ? tt('찾는 문장이 없어요') : savedFilter === 'learning' ? tt(savedTab === 's' ? '둘러보기에서 마음에 드는 문장을 저장해 보세요' : '둘러보기에서 마음에 드는 표현을 저장해 보세요') : tt('아직 외운 항목이 없어요')}
        </p>
      )}
      {sel && (
        <div className="bottom" style={{ display: 'flex', gap: 8 }}>
          <Button kind="light" disabled={!sel.length} onClick={() => bulk(() => patch(sel, () => ({ learned: true })))}>{tt('외웠어요')}</Button>
          <Button disabled={!sel.length} onClick={() => bulk(() => startReview(sel))}>{tt('이것만 복습')}</Button>
          <Button kind="danger" disabled={!sel.length} onClick={() => bulk(() => { set((s) => ({ saved: s.saved.filter((y) => !sel.includes(y.id)) })); toast(tt('{n}개를 삭제했어요', { n: sel.length })); })}>{tt('삭제')}</Button>
        </div>
      )}
    </div></section>
  );
}

