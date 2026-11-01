import { useRef, useState } from 'react';
import { Button, Chip, IconButton } from '../components/Button';
import { Icon } from '../components/Icon';
import { Grab, SheetHead } from '../components/Layer';
import { Pill } from '../components/Rows';
import { DAY } from '../constants';
import { daysLabel, dueItems, isWeak, minutesFor, nextDueText, todayCount, weakInToday, weakItems, WEAK_AT } from '../lib/srs';
import { useActions } from '../lib/useActions';
import { lang, sentence, startOfDay, trOf, wordInfo } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';
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

  const head = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 12px' }}>
      <h2 className="title" style={{ margin: 0 }}>배울래요</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <IconButton label="검색" onClick={() => setQ(q === null ? '' : null)}><Icon name="search" /></IconButton>
        <button className="add-btn" onClick={() => go('add')}><Icon name="plus" style={{ width: 16, height: 16, strokeWidth: 2.2 }} />문장 추가</button>
      </div>
    </div>
  );

  if (!state.saved.length) {
    return (
      <section className="screen"><div className="page">
        {head}
        <div className="empty-state">
          <div className="em-ico"><Icon name="mark" /></div>
          <b>아직 저장한 문장이 없어요</b>
          <p>둘러보기에서 단어를 누르거나 카드를 두 번 탭해서<br />마음에 드는 문장을 저장해 보세요.</p>
          <Button kind="dark" onClick={() => go('feed')}>둘러보러 가기</Button>
          <Button kind="link" onClick={() => go('add')}>직접 문장 추가하기</Button>
        </div>
      </div></section>
    );
  }

  const due = todayCount(state);
  const weakToday = weakInToday(state);
  const dueIds = new Set(dueItems(state).slice(0, state.daily).map((x) => x.id));
  const ofKind = state.saved.filter((x) => x.kind === savedTab);
  const learning = ofKind.filter((x) => !x.learned);
  const weak = ofKind.filter(isWeak);
  const learned = ofKind.filter((x) => x.learned);
  const countS = state.saved.filter((x) => x.kind === 's').length;
  const countW = state.saved.length - countS;
  const waiting = dueItems(state).length - due;
  const text = (x: SavedItem) => {
    const info = x.kind === 'w' ? wordInfo(x.card, x.wi, state.native) : null;
    return { head: info ? info.text : sentence(x.card), sub: info ? (info.mean || sentence(x.card)) : trOf(x.card.tr, state.native), say: info ? info.speak : sentence(x.card) };
  };
  let list = savedFilter === 'learning' ? learning : savedFilter === 'weak' ? weak : learned;
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
    if (gone) toast('삭제했어요', '되돌리기', () => set((s) => {
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
          <h3>어떤 문장을 복습할까요?</h3>
          {opt(`오늘 복습 전체 · ${due}개`, `약 ${minutesFor(due)}분`, false)}
          {opt(`약점만 · ${weakItems(state).length}개`, `'다시'를 ${WEAK_AT}번 이상 받은 문장 · 약 ${minutesFor(weakItems(state).length)}분`, true)}
          <Button onClick={() => { closeLayer(); startToday(state, weakOnly); }}>복습 시작</Button>
        </>
      );
    };
    openSheet(<Pick />);
  };

  const openDetail = (x: SavedItem) => {
    const t = text(x);
    const when = x.learned ? '외웠어요' : `${x.step || 0}단계 · 다음 복습 ${dueIn(x) ? daysLabel(dueIn(x)) : '오늘'}`;
    openSheet(
      <>
        <SheetHead title="문장 상세" />
        <div className="det-s">{t.head}</div>
        <div className="det-k">{t.sub}</div>
        <div className="det-act">
          <button className="chip" onClick={() => speak(t.say, x.card.lang)}>듣기</button>
          <button className="chip" onClick={() => speak(t.say, x.card.lang, { rate: 0.7 })}>느리게</button>
        </div>
        <div className="det-rows">
          <div><span>저장한 날</span><b>{new Date(x.at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</b></div>
          <div><span>복습 단계</span><b>{when}</b></div>
          <div><span>틀린 횟수</span><b style={{ color: x.lapses ? 'var(--danger)' : undefined }}>{x.lapses || 0}번</b></div>
        </div>
        <input className="det-memo" placeholder="메모를 남겨 보세요" defaultValue={x.note || ''} maxLength={120}
          onBlur={(e) => patch([x.id], () => ({ note: e.target.value.trim() || undefined }))} />
        <Button onClick={() => { closeLayer(); startReview([x.id]); }}>이 문장만 복습</Button>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button kind="light" onClick={() => { toggleLearned(x); closeLayer(); }}>{x.learned ? '다시 외우기' : '외웠어요'}</Button>
          <Button kind="danger" onClick={() => { closeLayer(); remove(x.id); }}>삭제</Button>
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
    <section className="screen"><div className="page" style={sel ? { paddingBottom: 150 } : undefined}>
      {sel ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 12px' }}>
          <Button kind="link" auto onClick={() => setSel(null)}>취소</Button>
          <b>{sel.length}개 선택</b>
          <Button kind="link" auto onClick={() => setSel(sel.length === list.length ? [] : list.map((x) => x.id))}>전체 선택</Button>
        </div>
      ) : head}
      {q !== null && !sel && <input className="det-memo" autoFocus placeholder="문장 · 뜻 검색" value={q} onChange={(e) => setQ(e.target.value)} />}
      {!sel && (
        <div className="review-banner">
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{due ? `오늘 복습 ${due}개` : '오늘 복습은 끝났어요'}</b>
            <span>{due ? (weakToday ? `약점 ${weakToday}개 포함 · 약 ${minutesFor(due)}분` : waiting > 0 ? `하루 ${state.daily}개씩 · ${waiting}개는 다음에` : `약 ${minutesFor(due)}분`) : (nextDueText(state) || '새로 저장하면 복습할 수 있어요')}</span>
          </div>
          <Button kind="dark" auto disabled={!due} style={{ minHeight: 44, padding: '10px 16px', fontSize: 14, borderRadius: 12 }} onClick={openStart}>복습 시작</Button>
        </div>
      )}
      <div className="seg">
        <button className={savedTab === 's' ? 'on' : ''} onClick={() => setSavedTab('s')}>문장<small>{countS}</small></button>
        <button className={savedTab === 'w' ? 'on' : ''} onClick={() => setSavedTab('w')}>단어·표현<small>{countW}</small></button>
      </div>
      <div className="grid" style={{ marginBottom: 4, alignItems: 'center' }}>
        <Chip on={savedFilter === 'learning'} onClick={() => setSavedFilter('learning')}>외우는 중</Chip>
        <Chip on={savedFilter === 'weak'} onClick={() => setSavedFilter('weak')}>약점<small>{weak.length}</small></Chip>
        <Chip on={savedFilter === 'learned'} onClick={() => setSavedFilter('learned')}>외웠어요</Chip>
        <button className="sort" onClick={() => setByRecent(!byRecent)}>{byRecent ? '최근 순' : '복습 순'} ▾</button>
      </div>
      {list.length ? list.map((x) => {
        const t = text(x);
        const d = dueIn(x);
        const badge = x.learned ? null : dueIds.has(x.id) ? <span className="bdg2 due">오늘 복습</span>
          : isWeak(x) ? <span className="bdg2 weak">약점 ×{x.lapses}</span> : <span className="bdg2">{daysLabel(d)}</span>;
        const on = sel?.includes(x.id);
        return (
          <div className={`item${on ? ' sel' : ''}`} key={x.id} {...press(x)}>
            {sel && <i className={`chk${on ? ' on' : ''}`} />}
            <div className="en">{t.head}<Pill>{lang(x.card.lang).name}</Pill>{badge}</div>
            <div className="ko">{t.sub}</div>
            {!sel && (
              <div className="btns" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                <IconButton label="발음 듣기" onClick={() => speak(t.say, x.card.lang)}><Icon name="speak" /></IconButton>
                <IconButton label={x.learned ? '다시 외우기' : '외웠어요'} style={x.learned ? { background: 'var(--blue-soft)' } : undefined} onClick={() => toggleLearned(x)}>
                  <Icon name="check" style={x.learned ? { stroke: 'var(--blue)' } : undefined} />
                </IconButton>
                <IconButton label="삭제" onClick={() => remove(x.id)}><Icon name="close" /></IconButton>
              </div>
            )}
          </div>
        );
      }) : (
        <p className="desc" style={{ padding: '24px 0', textAlign: 'center' }}>
          {needle ? '찾는 문장이 없어요' : savedFilter === 'learning' ? `둘러보기에서 마음에 드는 ${savedTab === 's' ? '문장을' : '표현을'} 저장해 보세요` : savedFilter === 'weak' ? '약점으로 잡힌 문장이 없어요' : '아직 외운 항목이 없어요'}
        </p>
      )}
      {sel && (
        <div className="bottom" style={{ display: 'flex', gap: 8 }}>
          <Button kind="light" disabled={!sel.length} onClick={() => bulk(() => patch(sel, () => ({ learned: true })))}>외웠어요</Button>
          <Button disabled={!sel.length} onClick={() => bulk(() => startReview(sel))}>이것만 복습</Button>
          <Button kind="danger" disabled={!sel.length} onClick={() => bulk(() => { set((s) => ({ saved: s.saved.filter((y) => !sel.includes(y.id)) })); toast(`${sel.length}개를 삭제했어요`); })}>삭제</Button>
        </div>
      )}
    </div></section>
  );
}
