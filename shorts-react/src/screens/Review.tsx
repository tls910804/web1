import { useEffect } from 'react';
import { Button, IconButton } from '../components/Button';
import { Icon } from '../components/Icon';
import { WordChips } from '../components/WordChips';
import { daysLabel, rateResult } from '../lib/srs';
import { useActions } from '../lib/useActions';
import { lang, langTag, sentence, trOf, wordInfo } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';

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
        <IconButton label="복습 그만두기" style={{ width: 38, height: 38 }} onClick={quit}><Icon name="close" /></IconButton>
        <div className="bar"><div style={{ width: `${pct}%` }} /></div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>{rv.i + 1} / {rv.ids.length}</span>
      </div>
      <div className="rv-body">
        <div className={`rcard${rv.shown ? ' back' : ''}`} onClick={() => rv.shown && setRv({ ...rv, shown: false })}>
          <span className="rc-chip">{c.cat} · {lang(c.lang).name}{item.kind === 'w' ? (item.wi >= 0 ? ' · 단어' : ' · 표현') : ''}</span>
          <div className="rc-main">
            {item.kind === 'w'
              ? <WordChips card={c} highlight={item.wi >= 0 ? [item.wi] : c.key} />
              : <p className="rc-s" lang={langTag(c.lang)}>{sentence(c)}</p>}
            {rv.shown ? (
              <>
                <div className="rc-line" />
                <p className="rc-tr">{trOf(c.tr, state.native)}</p>
                {(info || c.expr) && (
                  <div className="rc-expr"><b lang={langTag(c.lang)}>{info ? info.text : c.expr}</b><span>{info ? info.mean : trOf(c.mean, state.native)}</span></div>
                )}
              </>
            ) : (
              <p className="rc-hint">{item.kind === 'w' ? '파란 표시의 뜻을 먼저 떠올려 보세요' : '뜻을 먼저 떠올려 보세요'}</p>
            )}
          </div>
          <div className="rc-rail" onClick={(e) => e.stopPropagation()}>
            <button aria-label="발음 듣기" onClick={() => speak(sentence(c), c.lang)}><Icon name="speak" /></button>
            <button aria-label="느리게 듣기" onClick={() => speak(sentence(c), c.lang, { rate: 0.7 })}><Icon name="clock" /></button>
          </div>
        </div>
      </div>
      <div className={`foot${rv.shown ? ' back' : ''}`}>
        {rv.shown ? (
          <>
            <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--muted)' }}>기억났나요?</div>
            <div className="rates">
              <button className="ans again" onClick={() => answer('again')}>다시 볼래요<small>{daysLabel(rateResult(state.mode, item, 'again').days)}</small></button>
              <button className="ans good" onClick={() => answer('good')}>기억나요<small>{daysLabel(rateResult(state.mode, item, 'good').days)}</small></button>
            </div>
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>기억날수록 복습 간격이 길어져요</div>
          </>
        ) : (
          <>
            <Button kind="dark" style={{ minHeight: 49, padding: '14px 16px' }} onClick={() => setRv({ ...rv, shown: true })}>정답 보기</Button>
            <Button kind="link" style={{ marginTop: -4 }} onClick={() => answer('again')}>모르겠어요, 건너뛰기</Button>
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
      <div className={`foot${rv.shown ? ' back' : ''}`}>
        <Button kind="dark" onClick={() => go('saved')}>배울래요로 돌아가기</Button>
        <Button kind="link" disabled={!rv.again.length} onClick={() => startReview(rv.again.slice())}>틀린 것만 다시 보기</Button>
      </div>
    </section>
  );
}
