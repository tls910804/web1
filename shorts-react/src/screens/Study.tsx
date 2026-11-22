import { useEffect, useMemo, useRef, useState } from 'react';
import { tt } from '../i18n';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { NO_SPACE } from '../constants';
import { stopAudio } from '../lib/audio';
import { speechOk } from '../lib/speech';
import { useActions } from '../lib/useActions';
import { clean, lang, langTag, sentence, trOf } from '../lib/text';
import { streakOf } from '../lib/srs';
import { useStore } from '../store';
import { useUi } from '../ui';
import { BlankNote, KoLine, ding, findMiss, join, norm, visLen } from './Exercise';
import type { Card } from '../types';

const SIZE = 10;
// shortcut: 음성이 끝나는 시점을 알 수 없어 글자 수로 어림잡는다. 오디오 종료 이벤트를 받게 되면 바꾼다
const talkMs = (c: Card) => Math.max(1600, sentence(c).length * 75);
const nextMs = (c: Card) => talkMs(c) + 2200;

const hush = () => { stopAudio(); if (speechOk()) speechSynthesis.cancel(); };

type Res = { card: Card; ok: boolean };

/** 자동 공부: 한 번 듣기 → 빈칸 채우기 → 결과(저절로 다음), 10문장씩 */
export function Study() {
  const { state } = useStore();
  const { study, go, setIndex, speak } = useUi();
  const { findSaved, toggleSave } = useActions();
  const [start, setStart] = useState(0);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<'blank' | 'result' | 'done'>('blank');
  const [paused, setPaused] = useState(false);
  const [round, setRound] = useState(0); // 이어서 하기를 누르면 그 단계를 처음부터
  const [res, setRes] = useState<Res[]>([]);
  const chunk = useMemo(() => study?.queue.slice(start, start + SIZE) ?? [], [study, start]);
  const c = chunk[i];

  const next = () => {
    hush();
    if (i + 1 < chunk.length) { setI(i + 1); setPhase('blank'); } else setPhase('done');
  };

  // 빈칸을 만들 수 없는 카드는 바로 결과로
  useEffect(() => { if (c && phase === 'blank' && !c.key.length) setPhase('result'); }, [c?.id, phase]);
  // 결과 단계는 문장을 들려주고 시간이 되면 저절로 넘어간다
  useEffect(() => {
    if (!c || paused || phase !== 'result') return;
    speak(sentence(c), c.lang, { quiet: true });
    const t = setTimeout(next, nextMs(c));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id, phase, paused, round]);

  if (!study || (!c && phase !== 'done')) return <section className="screen glow" />;

  const exit = () => {
    hush();
    const seen = phase === 'done' ? chunk[chunk.length - 1] : c;
    const at = seen ? study.feedIds.indexOf(seen.id) : -1;
    if (at >= 0) setIndex(Math.min(at + 1, study.feedIds.length - 1));
    go(study.back ?? 'feed');
  };

  if (phase === 'done') {
    const okN = res.filter((r) => r.ok).length, all = okN === res.length && res.length > 0;
    const more = study.queue.length > start + SIZE;
    return (
      <section className="screen st-done">
        <Confetti gold={all} />
        <div className="st-done-body">
          <div className={`st-big${all ? ' gold' : ''}`}><Icon name="check" /></div>
          <h2>{all ? tt('전부 맞혔어요!') : tt('{n}문장 끝!', { n: chunk.length })}</h2>
          <p className="st-sum">{tt('빈칸 맞힘 {a} / {b}', { a: okN, b: res.length })}{streakOf(state.log) > 0 ? ` · ${tt('연속 {n}일', { n: streakOf(state.log) })}` : ''}</p>
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
          {more && <Button kind="dark" style={{ minHeight: 52, background: 'var(--blue)', color: '#fff' }} onClick={() => { setStart(start + SIZE); setI(0); setRes([]); setPhase('blank'); }}>{tt('다음 {n}문장', { n: SIZE })}</Button>}
          <Button kind="link" onClick={exit}>{tt('그만하기')}</Button>
        </div>
      </section>
    );
  }

  const last = res[res.length - 1];
  const result = phase === 'result' ? (last?.card.id === c.id ? (last.ok ? 'ok' : 'no') : 'ok') : null;
  let run = 0;
  for (let k = res.length - 1; k >= 0 && res[k].ok; k--) run++;
  const saved = !!findSaved('s', c);

  return (
    <section className={`screen study${result ? ' ' + result : ''}`}>
      <div className="st-top">
        <button className="ib" aria-label={tt('자동 공부 그만두기')} onClick={exit}><Icon name="close" /></button>
        {/* 문장마다 한 칸: 맞힘 초록, 놓침 노랑, 지금 파랑 */}
        <div className="st-dots" role="progressbar" aria-valuenow={i + 1} aria-valuemax={chunk.length}>
          {chunk.map((x, k) => {
            const r = res.find((y) => y.card.id === x.id);
            return <i key={x.id} className={r ? (r.ok ? 'ok' : 'no') : k === i ? 'now' : ''} />;
          })}
        </div>
        <span className="st-cnt"><b>{i + 1}</b> / {chunk.length}</span>
        <button className="ib" aria-label={tt('멈추기')} onClick={() => { hush(); setPaused(true); }}><Icon name="pause" /></button>
      </div>

      <div className="st-body">
        <div className={`st-card${result ? ' ' + result : ''}`}>
          {result && (
            <div className="st-res">
              <span key={c.id} className="ic">{result === 'ok' ? <Icon name="check" /> : '!'}</span>
              <b>{result === 'ok' ? tt('정답이에요!') : tt('괜찮아요, 다음에 또 나와요')}</b>
              {result === 'ok' && run >= 3 && <span className="st-run">{tt('{n}연속', { n: run })}</span>}
              <button className={`st-save${saved ? ' on' : ''}`} aria-label={tt('배울 문장으로 저장')} onClick={() => toggleSave('s', c)}><Icon name="mark" /></button>
            </div>
          )}
          <div className="st-ko">
            <small>{tt(c.cat)} · {lang(c.lang).name}</small>
            <p><KoLine card={c} native={state.native} /></p>
          </div>
          {phase === 'blank'
            ? <Blank key={c.id} card={c} onEnd={(ok) => { if (ok) ding(); setRes((r) => [...r, { card: c, ok }]); setTimeout(() => setPhase('result'), ok ? 450 : 200); }} />
            : (
              <div className="st-en">
                <p className="st-s" lang={langTag(c.lang)}>{c.words.map((w, k) => <span key={k} className={c.key.includes(k) ? 'key' : ''}>{w}{NO_SPACE[c.lang] ? '' : ' '}</span>)}</p>
                {phase === 'result' && c.expr && <p className="st-expr"><b lang={langTag(c.lang)}>{c.expr}</b> = {trOf(c.mean, state.native)}</p>}
              </div>
            )}
        </div>
        {phase === 'result' && (
          <div className="st-acts">
            <button onClick={() => speak(sentence(c), c.lang, { rate: 0.7 })}><Icon name="clock" />{tt('천천히')}</button>
            <button onClick={() => speak(sentence(c), c.lang)}><Icon name="speak" />{tt('다시 듣기')}</button>
            <button className="go" onClick={next}>
              <i key={`${c.id}-${paused}-${round}`} style={{ animationDuration: `${nextMs(c)}ms`, animationPlayState: paused ? 'paused' : 'running' }} />
              <svg viewBox="0 0 10 10"><path d="M1 0l8.5 5L1 10z" /></svg>{tt('다음')}
            </button>
          </div>
        )}
        {phase === 'blank' && <p className="st-cap">{c?.trKey?.[state.native] ? tt('색이 다른 부분에 맞는 표현을 빈칸에 써 보세요') : tt('뜻을 보고 빈칸에 들어갈 표현을 써 보세요')}</p>}
      </div>

      {paused && (
        <div className="st-pause" onClick={() => { setPaused(false); setRound((r) => r + 1); }}>
          <div className="sheet-in" onClick={(e) => e.stopPropagation()}>
            <b>{tt('멈췄어요')}</b>
            <small>{tt('{a} / {b} · 지금까지 {n}개 맞혔어요', { a: i + 1, b: chunk.length, n: res.filter((r) => r.ok).length })}</small>
            <Button kind="dark" style={{ minHeight: 52, background: 'var(--blue)', color: '#fff' }} onClick={() => { setPaused(false); setRound((r) => r + 1); }}>{tt('이어서 하기')}</Button>
            <Button kind="link" onClick={exit}>{tt('그만하기')}</Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** 빈칸: 힌트 → 정답 보기(흐리게 깔고 다시 쓰기), 다 쓰고 틀리면 몇 글자 다른지 */
function Blank({ card: c, onEnd }: { card: Card; onEnd: (ok: boolean) => void }) {
  const { state } = useStore();
  const { speak } = useUi();
  const { logAct } = useActions();
  const idx = c.key;
  const answer = clean(join(c, idx.map((i) => c.words[i])));
  const [text, setText] = useState('');
  const [hint, setHint] = useState(false);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState<null | boolean>(null);
  const [sent, setSent] = useState(false); // 엔터로 냈을 때는 짧게 써도 틀린 이유를 보여준다
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);
  const nHint = answer.length > 3 ? 2 : 1;
  const a = norm(answer, c.lang), t = norm(text, c.lang);
  const tried = !!t && t !== a && (t.length >= a.length || sent);
  const miss = !shown && text ? findMiss(text, answer, c.lang, state.native) : null;

  const finish = (ok: boolean) => {
    if (done !== null) return;
    setDone(ok);
    logAct('s');
    navigator.vibrate?.(ok ? 12 : [20, 40, 20]);
    onEnd(ok && !shown);
  };
  const onType = (v: string) => { setText(v); setSent(false); if (norm(v, c.lang) === a) finish(true); };

  const first = idx[0], lastI = idx[idx.length - 1];
  const tail = c.words[lastI].match(/[.,!?。、！？]+$/)?.[0] ?? '';
  const ghost = shown ? answer : '';
  const parts: React.ReactNode[] = [];
  c.words.forEach((w, i) => {
    if (i === first) {
      parts.push(
        <span key={i} className={`st-blank${done ? ' ok' : tried ? ' no' : ''}`}>
          {ghost && !done && <span className="ghost" aria-hidden>{ghost}</span>}
          {done ? answer : (
            <input ref={input} value={text} lang={langTag(c.lang)} aria-label={tt('빈칸 입력')} enterKeyHint="done"
              autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
              style={{ width: `${(Math.max(visLen(answer), visLen(text)) + 1) * 0.7}ch` }}
              onChange={(e) => onType(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setSent(true)} />
          )}
        </span>, tail, ' ',
      );
    } else if (!idx.includes(i)) parts.push(w, ' ');
  });

  return (
    <>
      <div className="st-en"><p className="st-s" lang={langTag(c.lang)}>{parts}</p></div>
      {/* 맞았는지 알려주는 글은 원문 문장 바로 아래에 */}
      <BlankNote code={c.lang} text={text} answer={answer} mean={trOf(c.mean, state.native)} shown={shown && !done} tried={tried} miss={miss} />
      {done === null && (
        <div className="st-tools">
          {hint
            ? <button className={`tb main${shown ? ' soft' : ''}`} onClick={() => { setShown(true); setText(''); input.current?.focus(); }}><Icon name="eye" />{tt('정답 보기')}</button>
            : <button className="tb main" onClick={() => { setHint(true); if (!a.startsWith(t) || text.length < nHint) setText(answer.slice(0, nHint)); input.current?.focus(); }}><Icon name="bulb" />{tt('힌트 보기')}</button>}
          <button className="tb" onClick={() => { speak(sentence(c), c.lang); input.current?.focus(); }}><Icon name="speak" />{tt('듣기')}</button>
          <button className="tb skip" onClick={() => finish(false)}>{tt('넘어가기')}<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg></button>
        </div>
      )}
    </>
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
