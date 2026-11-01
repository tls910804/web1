import { useEffect } from 'react';
import { Button, IconButton } from '../components/Button';
import { Icon } from '../components/Icon';
import { WordChips } from '../components/WordChips';
import { daysLabel, rateResult } from '../lib/srs';
import { useActions } from '../lib/useActions';
import { lang, sentence, trOf, wordInfo } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';
import type { Rate } from '../types';

const RATES: [Rate, string, string, string][] = [
  ['again', '다시', 'again', 'M8.5 16.2c1-1.3 2.2-1.9 3.5-1.9s2.5.6 3.5 1.9'],
  ['hard', '어려웠어요', 'hard', 'M9 15.5h6'],
  ['good', '알았어요', 'good', 'M8.5 14c1 1.3 2.2 1.9 3.5 1.9s2.5-.6 3.5-1.9'],
  ['easy', '쉬워요', 'easy', 'M8 13.5h8c0 2.5-1.8 4-4 4s-4-1.5-4-4z'],
];
const Face = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><path d="M9 9.5v.01M15 9.5v.01" strokeWidth="2.4" /><path d={d} />
  </svg>
);

export function Review() {
  const { state } = useStore();
  const { rv, setRv, go, openDialog, speak } = useUi();
  const { answer, finishStreak } = useActions();
  const item = rv ? state.saved.find((x) => x.id === rv.ids[rv.i]) : undefined;

  // 항목이 사라졌으면(삭제 등) 건너뛴다
  const missing = !!rv && !item;
  useEffect(() => {
    if (!rv || !missing) return;
    if (rv.i + 1 >= rv.ids.length) { finishStreak(); go('review-done'); }
    else setRv({ ...rv, i: rv.i + 1, shown: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing, rv?.i]);
  if (!rv || !item) return <section className="screen glow" />;

  const c = item.card;
  const pct = Math.round((rv.i / rv.ids.length) * 100);
  const info = item.kind === 'w' ? wordInfo(c, item.wi, state.native) : null;

  const quit = () => {
    const doneN = rv.known.length + rv.again.length, left = rv.ids.length - rv.i;
    if (!doneN) { go('saved'); return; }
    openDialog('복습을 그만할까요?', `지금까지 푼 ${doneN}개는 저장돼요. 남은 ${left}개는 다음에 다시 보여드릴게요.`, [
      { label: '계속하기', kind: 'light' },
      { label: '나가기', kind: 'dark', fn: () => { finishStreak(); go('saved'); } },
    ]);
  };

  return (
    <section className="screen rv-card">
      <div className="rv-top">
        <IconButton label="복습 그만두기" onClick={quit}><Icon name="close" /></IconButton>
        <div className="bar"><div style={{ width: `${pct}%` }} /></div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>{rv.i + 1} / {rv.ids.length}</span>
      </div>
      <div className="rv-body">
        <div className={`rcard${rv.shown ? ' back' : ''}`} onClick={() => rv.shown && setRv({ ...rv, shown: false })}>
          <div className="rc-top">
            <span className="rc-chip">{c.cat} · {lang(c.lang).name}{item.kind === 'w' ? (item.wi >= 0 ? ' · 단어' : ' · 표현') : ''}</span>
            <button className="rc-spk" aria-label="발음 듣기" onClick={(e) => { e.stopPropagation(); speak(sentence(c), c.lang); }}><Icon name="speak" /></button>
          </div>
          <div className="rc-s"><WordChips card={c} highlight={item.kind === 'w' && item.wi >= 0 ? [item.wi] : c.key} /></div>
          {rv.shown ? (
            <>
              <div className="rc-line" />
              <p className="rc-tr">{trOf(c.tr, state.native)}</p>
              {(info || c.expr) && (
                <div className="rc-expr"><b>{info ? info.text : c.expr}</b><span>{info ? info.mean : trOf(c.mean, state.native)}</span></div>
              )}
            </>
          ) : (
            <>
              <p className="rc-hint">{item.kind === 'w' ? '파란 표시의 뜻을 먼저 떠올려 보세요' : '뜻을 먼저 떠올려 보세요'}</p>
              <div className="rc-pills">
                <button onClick={() => speak(sentence(c), c.lang)}>다시 듣기</button>
                <button onClick={() => speak(sentence(c), c.lang, { rate: 0.7 })}>느리게</button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="foot">
        {rv.shown ? (
          <>
            <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700 }}>얼마나 기억났나요?</div>
            <div className="rates">
              {RATES.map(([r, label, cls, d]) => (
                <button key={r} className={`ans ${cls}`} onClick={() => answer(r)}><Face d={d} />{label}<small>{daysLabel(rateResult(state.mode, item, r).days)}</small></button>
              ))}
            </div>
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>카드를 탭하면 다시 앞면으로 돌아가요</div>
          </>
        ) : (
          <>
            <Button kind="dark" onClick={() => setRv({ ...rv, shown: true })}>정답 보기</Button>
            <Button kind="link" onClick={() => answer('again')}>모르겠어요, 건너뛰기</Button>
          </>
        )}
      </div>
    </section>
  );
}

export function ReviewDone() {
  const { state } = useStore();
  const { rv, go } = useUi();
  const { startReview } = useActions();
  if (!rv) return <section className="screen done" />;
  const total = rv.known.length + rv.again.length;
  return (
    <section className="screen done">
      <div className="ok"><Icon name="check" style={{ width: 44, height: 44, stroke: '#fff', strokeWidth: 2.5 }} /></div>
      <h1>오늘 복습 끝!</h1>
      <p>{total}개 중 <b style={{ color: 'var(--blue)' }}>{rv.known.length}개</b>를 알았어요.
        {rv.again.length ? <><br />모르는 {rv.again.length}개는 내일 다시 보여드릴게요.</> : <><br />모두 기억했어요!</>}</p>
      <div className="stats">
        <div><b>{rv.known.length}</b><span>알았어요</span></div>
        <div><b>{rv.again.length}</b><span>다시</span></div>
        <div className="hi"><b>{state.streak}일</b><span>연속 복습</span></div>
      </div>
      <div className="foot">
        <Button kind="dark" onClick={() => go('saved')}>배울래요로 돌아가기</Button>
        <Button kind="link" disabled={!rv.again.length} onClick={() => startReview(rv.again.slice())}>틀린 것만 다시 보기</Button>
      </div>
    </section>
  );
}
