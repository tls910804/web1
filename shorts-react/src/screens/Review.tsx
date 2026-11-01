import { useEffect } from 'react';
import { Button, IconButton } from '../components/Button';
import { Icon } from '../components/Icon';
import { Expr, Pill } from '../components/Rows';
import { WordChips } from '../components/WordChips';
import { daysLabel, rateResult } from '../lib/srs';
import { useActions } from '../lib/useActions';
import { lang, sentence, trOf, wordInfo } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';
import type { Rate } from '../types';

const RATES: [Rate, string, string][] = [['again', '다시', ''], ['hard', '어려웠어요', ''], ['good', '알았어요', 'good'], ['easy', '쉬워요', 'easy']];

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
    <section className="screen glow">
      <div className="rv-top">
        <IconButton label="복습 그만두기" onClick={quit}><Icon name="close" /></IconButton>
        <div className="bar"><div style={{ width: `${pct}%` }} /></div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>{rv.i + 1} / {rv.ids.length}</span>
      </div>
      <div className="rv-body">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18, fontSize: 12, fontWeight: 700 }}>
          {c.cat}<Pill>{lang(c.lang).name}</Pill>{item.kind === 'w' && <Pill>{item.wi >= 0 ? '단어' : '표현'}</Pill>}
        </div>
        <WordChips card={c} highlight={item.kind === 'w' && item.wi >= 0 ? [item.wi] : c.key} />
        {rv.shown ? (
          <>
            <p className="tr">{trOf(c.tr, state.native)}</p>
            {info ? <><div className="divider" /><Expr text={info.text} mean={info.mean} /></>
              : c.expr ? <><div className="divider" /><Expr text={c.expr} mean={trOf(c.mean, state.native)} /></> : null}
          </>
        ) : <div className="ask">{item.kind === 'w' ? '파란 표시의 뜻을 먼저 떠올려 보세요' : '뜻을 먼저 떠올려 보세요'}</div>}
      </div>
      <div className="foot">
        {rv.shown ? (
          <>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>얼마나 기억났나요?</div>
            <div className="rates">
              {RATES.map(([r, label, cls]) => (
                <button key={r} className={`ans ${cls}`} onClick={() => answer(r)}>{label}<small>{daysLabel(rateResult(state.mode, item, r).days)}</small></button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <IconButton label="발음 듣기" style={{ width: 54, height: 54, borderRadius: 14 }} onClick={() => speak(sentence(c), c.lang)}><Icon name="speak" style={{ width: 22, height: 22 }} /></IconButton>
            <Button kind="dark" style={{ flex: 1 }} onClick={() => setRv({ ...rv, shown: true })}>정답 보기</Button>
          </div>
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
