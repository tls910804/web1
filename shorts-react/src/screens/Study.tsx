import { useEffect, useMemo, useState } from 'react';
import { tt } from '../i18n';
import { Button, IconButton } from '../components/Button';
import { Icon } from '../components/Icon';
import { useActions, newItem } from '../lib/useActions';
import { lang, langTag, sentence, trOf } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';
import { Exercise } from './Exercise';
import type { Card } from '../types';

const SIZE = 10;
// shortcut: 음성이 끝나는 시점을 알 수 없어 글자 수로 어림잡는다. 오디오 종료 이벤트를 받게 되면 바꾼다
const talkMs = (c: Card) => Math.max(1600, sentence(c).length * 75);

/** 정답 효과음: 파일 없이 짧은 '띵' */
function ding() {
  try {
    const A = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new A(), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.36);
    o.onended = () => ctx.close();
  } catch { /* 소리를 못 내도 공부는 계속 */ }
}

type Res = { card: Card; ok: boolean };

/** 자동 공부: 한 번 듣기 → 빈칸 채우기 → 뜻 보기(저절로 넘어감), 10문장씩 */
export function Study() {
  const { state } = useStore();
  const { study, go, setIndex, speak } = useUi();
  const { findSaved, toggleSave } = useActions();
  const [start, setStart] = useState(0);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<'listen' | 'blank' | 'result' | 'done'>('listen');
  const [paused, setPaused] = useState(false);
  const [res, setRes] = useState<Res[]>([]);
  const chunk = useMemo(() => study?.queue.slice(start, start + SIZE) ?? [], [study, start]);
  const c = chunk[i];
  const last = res[res.length - 1];

  // 듣기: 들려주고 빈칸으로. 결과: 한 번 더 들려주고 다음 문장으로
  useEffect(() => {
    if (!c || paused || (phase !== 'listen' && phase !== 'result')) return;
    speak(sentence(c), c.lang, { quiet: true });
    const ms = phase === 'listen' ? talkMs(c) + 700 : talkMs(c) + 1600;
    const t = setTimeout(() => {
      if (phase === 'listen') setPhase(c.key.length ? 'blank' : 'result');
      else if (i + 1 < chunk.length) { setI(i + 1); setPhase('listen'); }
      else setPhase('done');
    }, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id, phase, paused]);

  if (!study || (!c && phase !== 'done')) return <section className="screen glow" />;

  const exit = () => {
    const seen = phase === 'done' ? chunk[chunk.length - 1] : c;
    const at = seen ? study.feedIds.indexOf(seen.id) : -1;
    if (at >= 0) setIndex(Math.min(at + 1, study.feedIds.length - 1));
    go('feed');
  };
  const onDone = (ok: boolean) => {
    if (ok) ding();
    setRes((r) => [...r, { card: c, ok }]);
    setTimeout(() => setPhase('result'), ok ? 450 : 250);
  };
  const tap = () => { if (phase === 'listen' || phase === 'result') setPaused((p) => !p); };

  if (phase === 'done') {
    const okN = res.filter((r) => r.ok).length, all = okN === res.length && res.length > 0;
    const more = study.queue.length > start + SIZE;
    return (
      <section className="screen st-done">
        <Confetti gold={all} />
        <div className="st-done-body">
          <div className={`st-big${all ? ' gold' : ''}`}><Icon name="check" /></div>
          <h2>{all ? tt('전부 맞혔어요!') : tt('{n}문장 끝!', { n: chunk.length })}</h2>
          <p className="st-sum">{tt('빈칸 맞힘 {a} / {b}', { a: okN, b: res.length })}{state.streak > 0 ? ` · ${tt('연속 {n}일', { n: state.streak })}` : ''}</p>
          <b className="st-lbl">{tt('담고 싶은 문장만 눌러요')}</b>
          <div className="st-list">
            {chunk.map((x) => {
              const on = !!findSaved('s', x);
              return (
                <div className="st-row" key={x.id}>
                  <div><b lang={langTag(x.lang)}>{sentence(x)}</b><small>{trOf(x.tr, state.native)}</small></div>
                  <button className={`st-mark${on ? ' on' : ''}`} aria-label={tt('배울 문장으로 저장')} onClick={() => toggleSave('s', x)}><Icon name="mark" /></button>
                </div>
              );
            })}
          </div>
        </div>
        <div className="foot">
          {more && <Button kind="dark" style={{ minHeight: 52, background: 'var(--blue)', color: '#fff' }} onClick={() => { setStart(start + SIZE); setI(0); setRes([]); setPhase('listen'); }}>{tt('다음 {n}문장', { n: SIZE })}</Button>}
          <Button kind="link" onClick={exit}>{tt('그만하기')}</Button>
        </div>
      </section>
    );
  }

  let run = 0;
  for (let k = res.length - 1; k >= 0 && res[k].ok; k--) run++;
  const pct = ((i + (phase === 'result' ? 1 : 0)) / chunk.length) * 100;
  const ms = talkMs(c) + 1600;

  return (
    <section className={`screen rv-card study${paused ? ' paused' : ''}`} onClick={tap}>
      <div className="rv-top" onClick={(e) => e.stopPropagation()}>
        <IconButton label={tt('자동 공부 그만두기')} style={{ width: 38, height: 38 }} onClick={exit}><Icon name="close" /></IconButton>
        <div className="bar"><div style={{ width: `${pct}%` }} /></div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>{i + 1} / {chunk.length}</span>
      </div>

      {phase === 'listen' ? (
        <div className="rv-body ex-body">
          <div className="rcard ex">
            <span className="rc-chip">{tt(c.cat)} · {lang(c.lang).name}</span>
            <p className="rc-s" lang={langTag(c.lang)}>{sentence(c)}</p>
            <span className="st-note">{c.key.length ? tt('다음엔 빈칸이 나와요. 잘 들어 두세요') : tt('잘 들어 보세요')}</span>
          </div>
          <div className="st-listen"><span className="st-pulse"><Icon name="speak" /></span><b>{tt('잘 들어 보세요')}</b></div>
        </div>
      ) : (
        <div onClick={(e) => phase === 'blank' && e.stopPropagation()}>
          <Exercise key={c.id} kind="type" item={newItem('s', c, -1, state.native)} auto onDone={onDone} onSkip={() => onDone(false)} />
        </div>
      )}

      {phase === 'result' && (
        <div className="foot">
          <div className={`ex-fb ${last?.card.id === c.id && !last.ok ? 'no' : 'ok'}`}>
            <div className="ex-note st-sheet">
              <b>{last?.card.id === c.id && !last.ok ? tt('괜찮아요! 다음에 다시 만나요') : tt('잘했어요!')}{run >= 3 && <span className="st-run">{tt('{n}연속 정답!', { n: run })}</span>}</b>
              <span className="st-tr">{trOf(c.tr, state.native)}</span>
              {c.expr && <small lang={langTag(c.lang)}>{c.expr} = {trOf(c.mean, state.native)}</small>}
              <i className="st-timer" key={`${c.id}-${paused}`} style={{ animationDuration: `${ms}ms` }} />
            </div>
          </div>
        </div>
      )}
      {paused && <div className="st-paused">{tt('멈췄어요 · 화면을 누르면 이어져요')}</div>}
    </section>
  );
}

function Confetti({ gold }: { gold: boolean }) {
  const cols = gold ? ['#f5b301', '#fbbf24', '#d97706', '#fde68a'] : ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4'];
  const bits = useMemo(() => Array.from({ length: gold ? 90 : 60 }, (_, k) => ({
    left: Math.random() * 100, delay: Math.random() * 0.35, dur: 1 + Math.random() * 0.8, rot: Math.random() * 360, c: cols[k % cols.length], round: k % 3 === 0,
  })), [gold]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="confetti" aria-hidden>
      {bits.map((b, k) => <i key={k} className={b.round ? 'r' : ''} style={{ left: `${b.left}%`, background: b.c, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, transform: `rotate(${b.rot}deg)` }} />)}
    </div>
  );
}
