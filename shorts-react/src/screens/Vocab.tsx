import { useEffect, useMemo, useState } from 'react';
import { tt } from '../i18n';
import { Button, Chip } from '../components/Button';
import { Icon } from '../components/Icon';
import WORDS from '../data/words.json';
import { langName, langTag } from '../lib/text';
import { buildSteps, dueAt, nextBox, pickSession, SESSION, type Step } from '../lib/vocab';
import { useStore } from '../store';
import { useUi } from '../ui';

// [단어, 뜻, 예문, 예문 뜻]. 영어 단어의 뜻은 한국어, 한국어 단어의 뜻은 영어
// shortcut: 앱에 묶어 둠. 몇천 개가 되면 언어별 파일로 나눠 받기
type Word = [string, string, string, string];
const BOOK = WORDS as unknown as Record<string, Word[]>;
const keyOf = (code: string, w: Word) => `${code}:${w[0]}`;
const shuffle = <T,>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

export function Vocab() {
  const { state } = useStore();
  const { speak } = useUi();
  const codes = Object.keys(BOOK).filter((c) => c !== state.native);
  const [picked, setPicked] = useState(() => state.learn.find((c) => codes.includes(c)) ?? codes[0]);
  const code = codes.includes(picked) ? picked : codes[0];
  const words = BOOK[code];
  const keys = words.map((w) => keyOf(code, w));
  const [queue, setQueue] = useState<number[] | null>(null);

  const now = Date.now();
  const learned = keys.filter((k) => (state.vocab[k]?.[0] ?? 0) >= 4).length;
  const learning = keys.filter((k) => state.vocab[k]).length - learned;
  const due = keys.filter((k) => state.vocab[k] && state.vocab[k][1] <= now).length;
  const next = pickSession(keys, state.vocab, now);
  const start = () => setQueue(pickSession(keys, state.vocab, Date.now()));

  return (
    <section className="screen">
      <div className="page vb">
        <h1>{tt('단어장')}</h1>
        {codes.length > 1 && <div className="vb-langs">{codes.map((c) => <Chip key={c} on={c === code} onClick={() => setPicked(c)}>{langName(c)}</Chip>)}</div>}
        <div className="my-card vb-top">
          <div className="vb-nums">
            <span><b>{learned}</b><small>{tt('외움')}</small></span>
            <span><b>{learning}</b><small>{tt('학습 중')}</small></span>
            <span><b>{words.length - learned - learning}</b><small>{tt('새 단어')}</small></span>
          </div>
          <div className="vb-bar"><i style={{ width: `${(learned / words.length) * 100}%` }} /><i className="mid" style={{ width: `${(learning / words.length) * 100}%` }} /></div>
          {next.length > 0
            ? <Button onClick={start}>{due > 0 ? tt('복습 {n}개 포함 · 학습 시작', { n: Math.min(due, SESSION) }) : tt('새 단어 {n}개 배우기', { n: next.length })}</Button>
            : <p className="vb-done">{tt('오늘 할 단어를 다 했어요')}</p>}
        </div>
        <ul className="vb-list">
          {words.map((w, i) => {
            const box = state.vocab[keys[i]]?.[0] ?? 0;
            return (
              <li key={w[0]}>
                <button onClick={() => speak(w[0], code)}>
                  <span><b lang={langTag(code)}>{w[0]}</b><small>{w[1]}</small></span>
                  <em aria-label={tt('외운 정도 5칸 중 {n}칸', { n: box })}>{[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= box ? 'on' : ''} />)}</em>
                  <Icon name="speak" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {queue && <Session key={queue.join()} code={code} ids={queue} onClose={() => setQueue(null)} onMore={start} more={next.length > 0} />}
    </section>
  );
}

function Session({ code, ids, onClose, onMore, more }: { code: string; ids: number[]; onClose: () => void; onMore: () => void; more: boolean }) {
  const { state, set } = useStore();
  const { speak } = useUi();
  const words = BOOK[code];
  const [steps, setSteps] = useState<Step[]>(() => buildSteps(ids, (i) => state.vocab[keyOf(code, words[i])]?.[0] ?? 0));
  const [at, setAt] = useState(0);
  const [missed, setMissed] = useState<number[]>([]);
  const [result, setResult] = useState<'ok' | 'no'>();
  const [chosen, setChosen] = useState<number>();
  const [text, setText] = useState('');
  const step = steps[at] as Step | undefined;
  const w = step ? words[step.w] : undefined;

  // 보기 4개: 정답 + 같은 단어장에서 아무거나 3개
  const options = useMemo(
    () => (step ? shuffle([step.w, ...shuffle(words.map((_, i) => i).filter((i) => i !== step.w)).slice(0, 3)]) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [at],
  );

  useEffect(() => {
    if (w && (step!.kind === 'intro' || step!.kind === 'meaning')) speak(w[0], code, { quiet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  const go = () => { setAt((i) => i + 1); setResult(undefined); setChosen(undefined); setText(''); };
  // 맞히면 저절로 넘어가요. 누를 것을 줄이려고
  useEffect(() => {
    if (result !== 'ok') return;
    const t = setTimeout(go, 900);
    return () => clearTimeout(t);
  }, [result]);

  const answer = (ok: boolean) => {
    if (!step || !w || result) return;
    setResult(ok ? 'ok' : 'no');
    if (step.kind !== 'meaning') speak(w[0], code, { quiet: true });
    if (!ok) {
      setMissed((m) => [...m, step.w]);
      setSteps((s) => [...s, step]); // 틀린 문제는 맨 뒤에서 한 번 더
      return;
    }
    // 이 단어의 남은 문제가 없으면 바로 기록 (중간에 닫아도 남아요)
    if (!steps.slice(at + 1).some((s) => s.w === step.w)) {
      const k = keyOf(code, w);
      set((s) => {
        const box = nextBox(s.vocab[k]?.[0] ?? 0, missed.includes(step.w));
        return { vocab: { ...s.vocab, [k]: [box, dueAt(box, Date.now())] } };
      });
    }
  };

  const same = (a: string) => a.trim().toLowerCase().replace(/\s+/g, ' ');

  return (
    <div className="vb-session" role="dialog" aria-label={tt('단어 학습')}>
      <div className="vb-head">
        <button aria-label={tt('닫기')} onClick={onClose}><Icon name="close" /></button>
        <div className="vb-bar"><i style={{ width: `${(Math.min(at, steps.length) / steps.length) * 100}%` }} /></div>
      </div>
      {!step || !w ? (
        <div className="vb-body vb-end">
          <h2>{tt('{n}개 학습 완료', { n: ids.length })}</h2>
          <p>{missed.length ? tt('헷갈린 단어는 내일 다시 나와요') : tt('다 맞혔어요!')}</p>
          <div className="vb-foot">
            {more && <Button onClick={onMore}>{tt('이어서 더 하기')}</Button>}
            <Button kind="line" onClick={onClose}>{tt('닫기')}</Button>
          </div>
        </div>
      ) : step.kind === 'intro' ? (
        <div className="vb-body">
          <small className="vb-q">{tt('새 단어')}</small>
          <button className="vb-word" onClick={() => speak(w[0], code)}><b lang={langTag(code)}>{w[0]}</b><Icon name="speak" /></button>
          <p className="vb-mean">{w[1]}</p>
          <button className="vb-ex" onClick={() => speak(w[2], code)}><b lang={langTag(code)}>{w[2]}</b><small>{w[3]}</small></button>
          <div className="vb-foot"><Button onClick={go}>{tt('다음')}</Button></div>
        </div>
      ) : (
        <div className="vb-body">
          <small className="vb-q">{step.kind === 'meaning' ? tt('뜻을 골라 보세요') : step.kind === 'word' ? tt('어떤 단어일까요?') : tt('단어를 써 보세요')}</small>
          {step.kind === 'meaning'
            ? <button className="vb-word" onClick={() => speak(w[0], code)}><b lang={langTag(code)}>{w[0]}</b><Icon name="speak" /></button>
            : <p className="vb-word"><b>{w[1]}</b></p>}
          {step.kind === 'type' ? (
            <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) answer(same(text) === same(w[0])); }}>
              <input key={at} autoFocus value={text} onChange={(e) => setText(e.target.value)} readOnly={!!result} lang={langTag(code)}
                className={result ?? ''} placeholder={tt('첫 글자: {c}', { c: w[0][0] })} aria-label={tt('단어를 써 보세요')} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
              {!result && <button type="button" className="vb-skip" onClick={() => answer(false)}>{tt('모르겠어요')}</button>}
            </form>
          ) : (
            <div className="vb-opts">
              {options.map((i) => (
                <button key={i} disabled={!!result} lang={step.kind === 'word' ? langTag(code) : undefined}
                  className={!result ? '' : i === step.w ? 'ok' : i === chosen ? 'no' : ''}
                  onClick={() => { setChosen(i); answer(i === step.w); }}>
                  {words[i][step.kind === 'meaning' ? 1 : 0]}
                </button>
              ))}
            </div>
          )}
          {result && <div className={`vb-ex ${result}`}><b lang={langTag(code)}>{w[0]} · {w[2]}</b><small>{w[1]} · {w[3]}</small></div>}
          {result === 'no' && <div className="vb-foot"><Button onClick={go}>{tt('다음')}</Button></div>}
        </div>
      )}
    </div>
  );
}
