import { useEffect, useState } from 'react';
import { tt } from '../i18n';
import { Button, IconButton } from '../components/Button';
import { FaceButton } from '../components/FaceButton';
import { Icon } from '../components/Icon';
import { WordChips } from '../components/WordChips';
import { DAY } from '../constants';
import { daysLabel, mastered, nextDueText, rateResult } from '../lib/srs';
import { useActions } from '../lib/useActions';
import { dayKey, lang, langTag, sentence, startOfDay, trOf, wordInfo } from '../lib/text';
import { Exercise, exKind } from './Exercise';
import { useStore } from '../store';
import { useUi } from '../ui';
import type { SavedItem } from '../types';

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
    openDialog(tt('복습을 그만할까요?'), tt('지금까지 푼 {a}개는 저장돼요. 남은 {b}개는 다음에 다시 보여드릴게요.', { a: doneN, b: left }), [
      { label: tt('계속하기'), kind: 'light' },
      { label: tt('나가기'), kind: 'dark', fn: () => { finishStreak(); go('saved'); } },
    ]);
  };

  const top = (
    <div className="rv-top">
        <IconButton label={tt('복습 그만두기')} style={{ width: 38, height: 38 }} onClick={quit}><Icon name="close" /></IconButton>
        <div className="bar"><div style={{ width: `${pct}%` }} /></div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>{rv.i + 1} / {rv.ids.length}</span>
      </div>
  );
  const ex = exKind(item);
  if (ex) {
    return (
      <section className="screen rv-card">
        {top}
        <Exercise key={`${item.id}-${rv.i}`} kind={ex} item={item} onDone={(ok, hinted) => answer(ok ? (hinted ? 'hard' : 'good') : 'again')} onSkip={() => answer('again')} />
      </section>
    );
  }

  return (
    <section className="screen rv-card">
      {top}
      <div className="rv-body">
        <div className={`rcard${rv.shown ? ' back' : ''}`} onClick={() => rv.shown && setRv({ ...rv, shown: false })}>
          <span className="rc-chip">{tt(c.cat)} · {lang(c.lang).name}{item.kind === 'w' ? ` · ${tt(item.wi >= 0 ? '단어' : '표현')}` : ''}</span>
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
              <p className="rc-hint">{item.kind === 'w' ? tt('파란 표시의 뜻을 먼저 떠올려 보세요') : tt('뜻을 먼저 떠올려 보세요')}</p>
            )}
          </div>
          <div className="rc-rail" onClick={(e) => e.stopPropagation()}>
            <button aria-label={tt('발음 듣기')} onClick={() => speak(sentence(c), c.lang)}><Icon name="speak" /></button>
            <button aria-label={tt('느리게 듣기')} onClick={() => speak(sentence(c), c.lang, { rate: 0.7 })}><Icon name="clock" /></button>
          </div>
        </div>
      </div>
      <div className={`foot${rv.shown ? ' back' : ''}`}>
        {rv.shown ? (
          <>
            <div className="rates">
              <FaceButton kind="again" label={tt('다시 볼래요')} sub={tt('5분 뒤')} onClick={() => answer('again')} />
              <FaceButton kind="good" label={tt('기억나요')} sub={daysLabel(rateResult(state.mode, item, 'good').days)} onClick={() => answer('good')} />
            </div>
          </>
        ) : (
          <>
            <Button kind="dark" style={{ minHeight: 49, padding: '14px 16px' }} onClick={() => setRv({ ...rv, shown: true })}>{tt('정답 보기')}</Button>
            <Button kind="link" style={{ marginTop: -6 }} onClick={() => answer('again')}>{tt('건너뛰기')}</Button>
          </>
        )}
      </div>
    </section>
  );
}


/** on일 때 1초마다 다시 그린다 (5분 뒤 카운트다운용) */
export function useNow(on: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

export function RetryBar({ label, items, now }: { label: string; items: SavedItem[]; now: number }) {
  if (!items.length) return null;
  return <div className="retry"><span>{label}</span><b>{mmss(Math.min(...items.map((x) => x.due)) - now)}</b></div>;
}

export function ReviewDone() {
  const { state } = useStore();
  const { rv, go } = useUi();
  const { startReview } = useActions();
  const [tab, setTab] = useState<'ok' | 'no' | null>(null);
  const again = rv ? state.saved.filter((x) => rv.again.includes(x.id)) : [];
  const waiting = again.filter((x) => x.due > Date.now());
  const now = useNow(waiting.length > 0);
  if (!rv) return <section className="screen done" />;
  const known = state.saved.filter((x) => rv.known.includes(x.id));
  const total = rv.known.length + rv.again.length;
  const t = tab ?? (known.length ? 'ok' : 'no');
  const week = Array.from({ length: 7 }, (_, i) => state.log[dayKey(now - i * DAY)]?.n || 0).reduce((a, b) => a + b, 0);
  const daysTo = (x: SavedItem) => Math.max(1, Math.round((startOfDay(x.due) - startOfDay(now)) / DAY));
  const row = (x: SavedItem, badge: string) => {
    const info = x.kind === 'w' ? wordInfo(x.card, x.wi, state.native) : null;
    return (
      <div className="rs-row" key={x.id}>
        <div><b lang={langTag(x.card.lang)}>{info ? info.text : sentence(x.card)}</b><span>{info ? info.mean : trOf(x.card.tr, state.native)}</span></div>
        <span className="bdg2">{badge}</span>
      </div>
    );
  };
  const retryNow = () => startReview(rv.again.slice());
  return (
    <section className="screen rdone">
      <div className="rd-page">
        <div className="rd-head">
          <div className="ok"><Icon name="check" style={{ width: 28, height: 28, stroke: '#fff', strokeWidth: 2.5 }} /></div>
          <h1>{tt('오늘 복습 끝!')}</h1>
          <p>{tt('{n}개 중 {k}개를 알았어요.', { n: total, k: rv.known.length })}</p>
        </div>
        {state.streak > 0 && (
          <div className="rd-streak">
            <b className="n">{state.streak}</b>
            <div><b>{state.streak > 1 ? tt('{n}일 연속으로 복습했어요', { n: state.streak }) : tt('오늘 복습을 마쳤어요')}</b><small>{nextDueText(state)}</small></div>
          </div>
        )}
        <div className="stats">
          <div><span>{tt('알았어요')}</span><b>{rv.known.length}</b></div>
          <div><span>{tt('이번 주 복습')}</span><b>{week}</b></div>
          <div className="hi"><span>{tt('오래 기억해요')}</span><b>{state.saved.filter(mastered).length}</b></div>
        </div>
        <div className="seg">
          <button className={t === 'ok' ? 'on' : ''} onClick={() => setTab('ok')}>{tt('맞췄어요')}<small>{known.length}</small></button>
          <button className={t === 'no' ? 'on' : ''} onClick={() => setTab('no')}>{tt('틀렸어요')}<small>{again.length}</small></button>
        </div>
        {t === 'ok' ? (
          <>
            {known.map((x) => row(x, daysLabel(daysTo(x))))}
            <p className="rd-note">{known.length ? tt('잘 기억할수록 다시 나오는 간격이 길어져요') : tt('이번에는 맞춘 문장이 없어요')}</p>
          </>
        ) : (
          <>
            <RetryBar label={tt('5분 뒤 다시 보여드려요')} items={waiting} now={now} />
            {again.map((x) => row(x, x.due > now ? tt('5분 뒤') : tt('지금')))}
            <p className="rd-note">{again.length ? tt('바로 이어서 복습하면 기억이 더 오래가요') : tt('모두 기억했어요!')}</p>
          </>
        )}
      </div>
      <div className="foot">
        {t === 'no' && again.length ? (
          <>
            <Button kind="dark" style={{ minHeight: 49, padding: '14px 16px' }} onClick={retryNow}>{tt('지금 바로 다시 보기')}</Button>
            <Button kind="link" style={{ marginTop: -13 }} onClick={() => go('saved')}>{tt('배울래요로 돌아가기')}</Button>
          </>
        ) : (
          <>
            <Button kind="dark" style={{ minHeight: 49, padding: '14px 16px' }} onClick={() => go('saved')}>{tt('배울래요로 돌아가기')}</Button>
            <Button kind="link" style={{ marginTop: -13 }} disabled={!again.length} onClick={retryNow}>{tt('틀린 것 지금 다시 보기')}</Button>
          </>
        )}
      </div>
    </section>
  );
}
