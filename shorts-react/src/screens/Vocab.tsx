import { useEffect, useState, type ReactNode } from 'react';
import { tt } from '../i18n';
import { Button, Chip } from '../components/Button';
import { Icon } from '../components/Icon';
import WORDS from '../data/words.json';
import TOPIC_DATA from '../data/word-topics.json';
import { langName, langTag } from '../lib/text';
import { buildSteps, cloze, dueAt, hintShape, KNOWN, knownLog, nextBox, pickSession, placementIds, SESSION, why, type Op, type Step } from '../lib/vocab';
import { useStore } from '../store';
import { useUi } from '../ui';

// [단어, 뜻, 예문, 예문 뜻, 예문 속 모양(활용형일 때만)]. 영어 단어의 뜻은 한국어, 한국어 단어의 뜻은 영어
// shortcut: 앱에 묶어 둠. 몇천 개가 되면 언어별 파일로 나눠 받기
type Word = [string, string, string, string, string?];
const BOOK = WORDS as unknown as Record<string, Word[]>;
const keyOf = (code: string, w: Word) => `${code}:${w[0]}`;
// 주제 → 단어들. 주제 이름은 tt()로 번역해요
const TOPICS = TOPIC_DATA as Record<string, Record<string, string[]>>;
// 아는 단어 고르기를 한 번 지나갔다는 표시 (단어 키와 겹치지 않게 '#')
const startKey = (code: string) => `${code}#start`;
const EMOJI: Record<string, string> = {
  '일상·약속': '📅', '시간·약속': '⏰', '쇼핑·돈': '🛍️', '음식': '🍜', '여행·교통': '✈️', '회사·공부': '💼', '감정·생각': '💭',
  '건강': '💊', '자주 쓰는 표현': '💬', '장소': '📍', '사람': '👥', '날씨·건강': '🌦️', '취미·일': '🎨', '기본 동사·형용사': '🔤',
};

export function Vocab() {
  const { state, set } = useStore();
  const { speak } = useUi();
  const codes = Object.keys(BOOK).filter((c) => c !== state.native);
  const [picked, setPicked] = useState(() => state.learn.find((c) => codes.includes(c)) ?? codes[0]);
  const code = codes.includes(picked) ? picked : codes[0];
  const words = BOOK[code];
  const keys = words.map((w) => keyOf(code, w));
  const topics = TOPICS[code] ?? {};
  const topic = topics[state.vocabTopic] ? state.vocabTopic : '';
  const inTopic = (i: number) => !topic || topics[topic].includes(words[i][0]);
  const pick = () => pickSession(keys, state.vocab, Date.now(), SESSION, inTopic);
  // 처음엔 아는 단어 고르기, 그다음부터는 학습 화면이 첫 화면이에요. 목록은 버튼으로
  const [view, setView] = useState<'pick' | 'study' | 'list'>(() => (!state.vocab[startKey(code)] ? 'pick' : pick().length ? 'study' : 'list'));
  const [queue, setQueue] = useState<number[]>(() => pick());

  const now = Date.now();
  const shown = keys.filter((_, i) => inTopic(i));
  const known = shown.filter((k) => state.vocab[k]?.[0] === KNOWN).length;
  const learned = shown.filter((k) => (state.vocab[k]?.[0] ?? 0) >= 4).length - known;
  const learning = shown.filter((k) => state.vocab[k]).length - learned - known;
  const due = shown.filter((k) => state.vocab[k] && state.vocab[k][0] !== KNOWN && state.vocab[k][1] <= now).length;
  const next = pick();
  const start = () => { setQueue(pick()); setView('study'); };
  const toggle = (k: string) => set((s) => {
    const vocab = { ...s.vocab };
    if (vocab[k]?.[0] === KNOWN) delete vocab[k]; else vocab[k] = knownLog();
    return { vocab };
  });
  const topicChips = Object.keys(topics).length > 0 && (
    <div className="vb-topics">
      <Chip on={!topic} onClick={() => set({ vocabTopic: '' })}><span aria-hidden>📚 </span>{tt('전체')}</Chip>
      {Object.keys(topics).map((t) => <Chip key={t} on={t === topic} onClick={() => set({ vocabTopic: t })}>{EMOJI[t] && <span aria-hidden>{EMOJI[t]} </span>}{tt(t)}</Chip>)}
    </div>
  );

  if (view === 'pick') return (
    <section className="screen">
      <Placement code={code} words={words} keys={keys} chips={topicChips}
        onDone={(sel) => {
          const vocab = { ...state.vocab, [startKey(code)]: [0, Date.now()] as [number, number] };
          for (const k of sel) vocab[k] = knownLog();
          set({ vocab });
          // 고른 뒤 바로 학습으로
          const q = pickSession(keys, vocab, Date.now(), SESSION, inTopic);
          setQueue(q); setView(q.length ? 'study' : 'list');
        }} />
    </section>
  );

  if (view === 'study' && queue.length) return (
    <section className="screen">
      <Session key={queue.join()} code={code} ids={queue} onList={() => setView('list')} onMore={start} more={next.length > 0} />
    </section>
  );

  return (
    <section className="screen">
      <div className="page vb">
        <h1>{tt('단어장')}</h1>
        {codes.length > 1 && <div className="vb-langs">{codes.map((c) => <Chip key={c} on={c === code} onClick={() => setPicked(c)}>{langName(c)}</Chip>)}</div>}
        {topicChips}
        <div className="my-card vb-top">
          <div className="vb-nums">
            <span><b>{learned}</b><small>{tt('외움')}</small></span>
            <span><b>{learning}</b><small>{tt('학습 중')}</small></span>
            <span><b>{shown.length - learned - learning - known}</b><small>{tt('새 단어')}</small></span>
          </div>
          <div className="vb-bar"><i style={{ width: `${(learned / shown.length) * 100}%` }} /><i className="mid" style={{ width: `${(learning / shown.length) * 100}%` }} /></div>
          {known > 0 && <p className="vb-done">{tt('아는 단어 {n}개는 빼고 배워요', { n: known })}</p>}
          {next.length > 0
            ? <Button onClick={start}>{due > 0 ? tt('복습 {n}개 포함 · 학습 시작', { n: Math.min(due, SESSION) }) : tt('새 단어 {n}개 배우기', { n: next.length })}</Button>
            : <p className="vb-done">{tt('오늘 할 단어를 다 했어요')}</p>}
          <Button kind="line" onClick={() => setView('pick')}>{tt('수준 테스트 다시 하기')}</Button>
        </div>
        <ul className="vb-list">
          {words.map((w, i) => {
            if (!inTopic(i)) return null;
            const box = state.vocab[keys[i]]?.[0] ?? 0;
            const off = box === KNOWN;
            return (
              <li key={w[0]} className={off ? 'off' : ''}>
                <button onClick={() => speak(w[0], code)}>
                  <span><b lang={langTag(code)}>{w[0]}</b><small>{off ? tt('뺀 단어') : w[1]}</small></span>
                  {!off && <em aria-label={tt('외운 정도 5칸 중 {n}칸', { n: box })}>{[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= box ? 'on' : ''} />)}</em>}
                  <Icon name="speak" />
                </button>
                <button className="vb-x" onClick={() => toggle(keys[i])}>{off ? tt('되돌리기') : tt('빼기')}</button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

const shuffle = <T,>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

/** 수준 테스트 (말해보카처럼): 단어 20개의 뜻을 빠르게 고르고, 맞힌 단어는 아는 단어로 빼요 */
function Placement({ code, words, keys, chips, onDone }: { code: string; words: Word[]; keys: string[]; chips: ReactNode; onDone: (sel: string[]) => void }) {
  const { state } = useStore();
  const { speak } = useUi();
  const [ids] = useState(() => placementIds(keys, state.vocab));
  const [at, setAt] = useState(0);
  const [right, setRight] = useState<string[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const i = ids[at];
  const w = i === undefined ? undefined : words[i];
  // 보기 4개: 정답 + 다른 단어 뜻 3개
  const [opts, setOpts] = useState<number[]>([]);
  useEffect(() => {
    if (i === undefined) return;
    setOpts(shuffle([i, ...shuffle(words.map((_, k) => k).filter((k) => k !== i)).slice(0, 3)]));
    speak(words[i][0], code, { quiet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  const choose = (k: number | null) => {
    if (picked !== null || i === undefined) return;
    setPicked(k ?? -1);
    if (k === i) setRight((r) => [...r, keys[i]]);
    // 누르면 잠깐 정답만 보여 주고 저절로 다음
    setTimeout(() => { setPicked(null); setAt((a) => a + 1); }, k === i ? 450 : 900);
  };

  const story = (
    <div className="vb-head">
      <div className="vb-story">{ids.map((x, k) => <i key={x} className={k < at ? 'on' : k === at ? 'now' : ''} />)}</div>
      {w && <button onClick={() => onDone(right)}>{tt('건너뛰기')}</button>}
    </div>
  );

  if (!w) return (
    <div className="vb-session vb-pick">
      {story}
      <div className="vb-body vb-end">
        <span className="vb-trophy"><Icon name="check" /></span>
        <h2>{tt('{n}개를 이미 알고 있어요', { n: right.length })}</h2>
        <p>{tt('아는 단어는 빼고, 모르는 단어부터 배워요. 배우고 싶은 주제도 골라 보세요.')}</p>
        {chips}
        <div className="vb-foot"><Button kind="dark" style={{ minHeight: 49, padding: '14px 16px' }} onClick={() => onDone(right)}>{tt('학습 시작')}</Button></div>
      </div>
    </div>
  );

  return (
    <div className="vb-session vb-pick">
      {story}
      <div className="vb-body vb-test">
        <span className="rc-chip">{tt('수준 테스트')} · {langName(code)}</span>
        <button className="vb-word" onClick={() => speak(w[0], code)}><b lang={langTag(code)}>{w[0]}</b><Icon name="speak" /></button>
        <p className="vb-q">{tt('알맞은 뜻을 골라 보세요')}</p>
        <div className="vb-opts">
          {opts.map((k) => (
            <button key={k} disabled={picked !== null} onClick={() => choose(k)}
              className={picked === null ? '' : k === i ? 'ok' : k === picked ? 'no' : ''}>{words[k][1]}</button>
          ))}
        </div>
        <div className="vb-foot"><Button kind="link" onClick={() => choose(null)}>{tt('몰라요')}</Button></div>
      </div>
    </div>
  );
}

const SPEEDS = [1, 0.8, 0.6];

/** 내 답: 틀린 글자는 빨강, 빠진 자리는 ‸ */
function Mine({ text, ops }: { text: string; ops: Op[] }) {
  const c = [...text], out: ReactNode[] = [];
  for (let i = 0; i <= c.length; i++) {
    if (ops.some((o) => o.k === 'miss' && o.t === i)) out.push(<i key={`m${i}`} className="gap">‸</i>);
    if (i < c.length) out.push(ops.some((o) => o.k !== 'miss' && o.t === i) ? <i key={i} className="bad">{c[i]}</i> : c[i]);
  }
  return <>{out}</>;
}
/** 정답: 고쳐야 하는 글자에 초록 밑줄 */
const Right = ({ text, ops }: { text: string; ops: Op[] }) => <>{[...text].map((ch, j) => (ops.some((o) => o.k !== 'extra' && o.a === j) ? <i key={j} className="fix">{ch}</i> : ch))}</>;

/** 틀린 이유 한 줄 */
function reason(kind: string, ops: Op[], typed: string, ans: string, w: Word) {
  if (kind === 'form') return [tt('단어는 맞지만 모양이 달라요'), tt('이 문장에서는 ‘{a}’로 써요. 기본형은 ‘{b}’예요.', { a: ans, b: w[0] })];
  if (kind === 'short') return [tt('글자가 모자라요'), tt('‘{t}’까지는 맞아요. 뒤에 {n}글자가 더 있어요.', { t: typed, n: [...ans].length - [...typed].length })];
  if (kind === 'long') return [tt('글자가 더 많아요'), tt('‘{a}’까지만 쓰면 돼요.', { a: ans })];
  if (kind === 'other') return [tt('다른 단어예요'), tt('이 자리에는 ‘{m}’라는 뜻의 단어가 들어가요.', { m: w[1] })];
  const o = ops[0], t = [...typed], a = [...ans];
  const one = ops.length !== 1 ? ''
    : o.k === 'miss' ? tt('‘{c}’ 글자를 하나 빠뜨렸어요.', { c: a[o.a] })
    : o.k === 'extra' ? tt('‘{c}’ 글자가 하나 더 들어갔어요.', { c: t[o.t] })
    : tt('‘{a}’ 자리에 ‘{b}’ 글자를 썼어요.', { a: a[o.a], b: t[o.t] });
  return [tt('철자가 {n}글자 달라요', { n: ops.length }), one];
}

// 한 판에 단어 20개, 단어마다 빈칸 한 번. 틀린 단어는 다 맞힐 때까지 다음 판으로 이어서
function Session({ code, ids, onList, onMore, more }: { code: string; ids: number[]; onList: () => void; onMore: () => void; more: boolean }) {
  const { state, set } = useStore();
  const { speak } = useUi();
  const words = BOOK[code];
  const [round, setRound] = useState(1);
  const [list, setList] = useState(ids);
  const [steps, setSteps] = useState<Step[]>(() => buildSteps(ids, (i) => state.vocab[keyOf(code, words[i])]?.[0] ?? 0));
  const [at, setAt] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const [miss, setMiss] = useState<number[]>([]);
  const [knew, setKnew] = useState<number[]>([]); // '이미 알아요'로 뺀 단어 (맞힌 수에 안 셈)
  // ok: 맞힘, wrong: 틀림, shown: 정답 봄. 셋 다 그 단어는 끝
  const [result, setResult] = useState<'ok' | 'wrong' | 'shown'>();
  const [hint, setHint] = useState(false);
  const [text, setText] = useState('');
  const step = steps[at] as Step | undefined;
  const w = step ? words[step.w] : undefined;
  const en = code === 'en';

  const gap = w ? cloze(w[2], w[4] ?? w[0], en) ?? ['', w[0], ''] : null;
  const ans = gap?.[1] ?? '';

  useEffect(() => {
    if (w && step!.kind === 'intro') speak(w[0], code, { quiet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, round]);

  const go = () => { setAt((i) => i + 1); setResult(undefined); setHint(false); setText(''); };
  // 맞히면 저절로 다음 단어
  useEffect(() => {
    if (result !== 'ok') return;
    const t = setTimeout(go, 1500);
    return () => clearTimeout(t);
  }, [result]);

  const end = (r: 'ok' | 'wrong' | 'shown' | 'skip' | 'known') => {
    if (!step || !w || result) return;
    if (r === 'known') {
      const k = keyOf(code, w);
      set((s) => ({ vocab: { ...s.vocab, [k]: knownLog() } }));
      setDone((d) => [...d, step.w]); setKnew((x) => [...x, step.w]);
      // 소개 화면이면 뒤의 빈칸 문제도 건너뛰어요
      setAt(steps[at + 1]?.w === step.w ? at + 2 : at + 1); setHint(false); setText('');
      return;
    }
    const missed = r !== 'ok' || hint;
    setDone((d) => [...d, step.w]);
    if (missed) setMiss((m) => [...m, step.w]);
    // 첫 판은 맞힘·틀림 모두 기록, 다시 하는 판은 이미 1칸이라 그대로
    if (round === 1 || missed) {
      const k = keyOf(code, w);
      set((s) => {
        const box = nextBox(s.vocab[k]?.[0] ?? 0, missed);
        return { vocab: { ...s.vocab, [k]: [box, dueAt(box, Date.now())] } };
      });
    }
    if (r === 'skip') return go();
    setResult(r);
    speak(w[2], code, { quiet: true });
  };

  const same = (a: string) => a.trim().toLowerCase().replace(/\s+/g, ' ');
  const check = () => { if (text.trim() && !result) end(same(text) === same(ans) ? 'ok' : 'wrong'); };
  const again = () => { setRound((r) => r + 1); setList(miss); setSteps(miss.map((w): Step => ({ w, kind: 'cloze' }))); setAt(0); setDone([]); setMiss([]); };

  // 인스타그램 스토리처럼 단어마다 한 칸
  const prog = (
    <div className="vb-head">
      <div className="vb-story" role="progressbar" aria-valuenow={done.length} aria-valuemax={list.length}>
        {list.map((x) => <i key={x} className={done.includes(x) ? 'on' : step?.w === x ? 'now' : ''} />)}
      </div>
      <button onClick={onList}>{tt('단어 목록')}</button>
    </div>
  );

  if (!step || !w) {
    const right = list.length - miss.length - knew.length;
    return (
      <div className="vb-session">
        {prog}
        <div className="vb-body vb-end">
          {miss.length ? (
            <>
              <h2>{right ? tt('{n}개 맞혔어요', { n: right }) : tt('한 번 더 해 봐요')}</h2>
              <p>{tt('헷갈린 단어를 바로 이어서 연습해요')}</p>
              <div className="vb-foot"><Button onClick={again}>{tt('이어서 공부하기')}</Button></div>
            </>
          ) : (
            <>
              <span className="vb-trophy"><Icon name="check" /></span>
              <h2>{right > 0 ? tt('{n}개 모두 맞혔어요!', { n: round === 1 ? right : list.length - knew.length }) : tt('다 끝났어요!')}</h2>
              <p>{more ? tt('다음 {n}개 배우러 갈까요?', { n: SESSION }) : tt('오늘 할 단어를 다 했어요')}</p>
              <div className="vb-foot">
                {more && <Button onClick={onMore}>{tt('다음 {n}개 배우기', { n: SESSION })}</Button>}
                <Button kind={more ? 'link' : 'line'} onClick={onList}>{tt('단어 목록')}</Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (step.kind === 'intro') return (
    <div className="vb-session">
      {prog}
      <div className="vb-body">
        <small className="vb-q">{tt('새 단어')}</small>
        <button className="vb-word" onClick={() => speak(w[0], code)}><b lang={langTag(code)}>{w[0]}</b><Icon name="speak" /></button>
        <p className="vb-mean">{w[1]}</p>
        <button className="vb-ex" onClick={() => speak(w[2], code)}><b lang={langTag(code)}>{w[2]}</b><small>{w[3]}</small></button>
        <div className="vb-foot">
          <Button kind="dark" style={{ minHeight: 49, padding: '14px 16px' }} onClick={go}>{tt('다음')}</Button>
          <Button kind="link" style={{ marginTop: -6 }} onClick={() => end('known')}>{tt('이미 알아요')}</Button>
        </div>
      </div>
    </div>
  );

  const typed = text.trim();
  const fault = result === 'wrong' ? why(typed, ans, w[0]) : null;
  const [title, detail] = fault ? reason(fault.kind, fault.ops, typed, ans, w) : ['', ''];
  const marks = fault && fault.kind !== 'other' ? fault.ops : [];

  return (
    <div className="vb-session">
      {prog}
      <div className="vb-body">
        <div className={`rcard ex vb-card${result ? ' ' + result : ''}`}>
          {result ? (
            <div className="vb-res">
              <span className="ic">{result === 'ok' ? <Icon name="check" /> : '!'}</span>
              <b>{result === 'ok' ? tt('정답이에요!') : tt('괜찮아요, 다음에 또 나와요')}</b>
            </div>
          ) : <span className="rc-chip">{tt('단어 빈칸')} · {langName(code)}</span>}
          <form onSubmit={(e) => { e.preventDefault(); check(); }}>
            <p className="rc-s" lang={langTag(code)}>
              {gap![0]}
              <span className="vb-slot">
                <span className={`ex-blank${result === 'ok' ? ' ok' : result === 'wrong' ? ' no shake' : result === 'shown' ? ' show' : hint ? ' hinted' : ''}`}>
                  {result === 'ok' || result === 'shown' ? ans : result === 'wrong' ? typed : (
                    <input key={at} autoFocus value={text} onChange={(e) => { setText(e.target.value); if (same(e.target.value) === same(ans)) end('ok'); }}
                      style={{ width: `${(Math.max([...ans].length, [...text].length) + 1) * (en ? 0.8 : 1.4)}ch` }}
                      placeholder={hint ? hintShape(ans) : '·'.repeat([...ans].length)}
                      aria-label={tt('빈칸을 채워 보세요')} enterKeyHint="done"
                      autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} />
                  )}
                </span>
                {hint && !result && <small>{tt('{n}글자', { n: [...ans].length })}</small>}
              </span>
              {gap![2]}
            </p>
          </form>
          <p className="rc-tr">{w[3]}</p>
          {result === 'ok' && <p className="vb-meanline" lang={langTag(code)}>{ans} = {w[1]}</p>}

          {fault && (
            <div className="vb-why" role="alert">
              <b>{title}</b>
              <div className="vb-row"><small>{tt('내 답')}</small><span lang={langTag(code)}><Mine text={typed} ops={marks} /></span></div>
              <div className="vb-row right"><small>{tt('정답')}</small><span lang={langTag(code)}><Right text={ans} ops={marks} /></span></div>
              {detail && <p>{detail}</p>}
              <p className="mean">{ans} = {w[1]}</p>
            </div>
          )}
          {result === 'shown' && (
            <div className="vb-ans">
              <b>{tt('정답은')} <span lang={langTag(code)}>{ans}</span></b>
              <small>{w[1]}{ans !== w[0] ? ` · ${tt('기본형')} ${w[0]}` : ''}</small>
            </div>
          )}

          <div className="vb-audio">
            <button className="play" aria-label={tt('예문 듣기')} onClick={() => speak(w[2], code)}><Icon name="speak" /></button>
            <span>{tt('예문 듣기')}</span>
            <div className="spd" role="radiogroup" aria-label={tt('듣기 속도')}>
              {SPEEDS.map((v) => (
                <button key={v} role="radio" aria-checked={state.speed === v} className={state.speed === v ? 'on' : ''}
                  onClick={() => { set({ speed: v }); speak(w[2], code, { speed: v }); }}>{v}×</button>
              ))}
            </div>
          </div>

          {!result && (hint
            ? <button className="vb-act vb-ans-btn" onClick={() => end('shown')}><Icon name="eye" />{tt('정답 보기')}</button>
            : <button className="vb-act vb-hint-btn" onClick={() => setHint(true)}><Icon name="bulb" />{tt('힌트 보기')}</button>)}
        </div>

        <div className="vb-foot">
          {result
            ? <Button kind="dark" style={{ minHeight: 49, padding: '14px 16px' }} onClick={go}>{tt('다음')}</Button>
            : <>
                <Button kind="dark" style={{ minHeight: 49, padding: '14px 16px' }} disabled={!text.trim()} onClick={check}>{tt('확인')}</Button>
                <div className="vb-links">
                  <Button kind="link" auto onClick={() => end('skip')}>{tt('건너뛰기')}</Button>
                  <i aria-hidden>·</i>
                  <Button kind="link" auto onClick={() => end('known')}>{tt('이미 알아요')}</Button>
                </div>
              </>}
        </div>
      </div>
    </div>
  );
}
