import { useEffect, useMemo, useRef, useState } from 'react';
import { tt } from '../i18n';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { CARDS } from '../data';
import { stopAudio } from '../lib/audio';
import { speechOk } from '../lib/speech';
import { useUi } from '../ui';
import CALLS from '../data/calls.json';

// shortcut: 진짜 AI가 아니라 정해 둔 대본(data/calls.json)으로 통화한다. AI 대화를 붙이려면 서버와 언어 모델 API가 필요하다
// AI 대사 음성은 tools/audio/gen_call.py로 미리 만들어 public/audio에 넣는다(없으면 기기 음성)
type Turn = { ai: string; ko: string; replies: { en: string; ko: string }[] };
type Scene = { id: string; title: string; who: string; role: string; sub: string; voice: string; mission: string[]; turns: Turn[] };
const SCENES = CALLS as Scene[];
const LIMIT = 180; // 통화 한 번 3분

type Rec = { new (): SpeechRec };
interface SpeechRec { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null; start(): void; stop(): void; abort(): void }
const W = window as unknown as { SpeechRecognition?: Rec; webkitSpeechRecognition?: Rec };
const Recognition = W.SpeechRecognition || W.webkitSpeechRecognition;

const words = (s: string) => s.toLowerCase().replace(/[^a-z' ]/g, '').split(' ').filter(Boolean);
const closeness = (said: string, ref: string) => {
  const a = new Set(words(said)), b = words(ref);
  return b.length ? b.filter((w) => a.has(w)).length / b.length : 0;
};
const mmss = (s: number) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const talkMs = (s: string) => Math.max(1600, s.length * 62);
const hush = () => { stopAudio(); if (speechOk()) speechSynthesis.cancel(); };

// 앱 카드에 있는 영어 표현은 대사 안에서 밑줄로 보여준다 (배운 표현을 실전에서 다시 만나게)
const EXPRS = [...new Set(CARDS.filter((c) => c.lang === 'en' && c.expr).map((c) => c.expr.toLowerCase()))].sort((a, b) => b.length - a.length);
function Marked({ text, upto }: { text: string; upto?: number }) {
  const lower = text.toLowerCase();
  const hit = EXPRS.map((e) => ({ e, i: lower.indexOf(e) })).find((x) => x.i >= 0);
  const ws = text.split(' ');
  let pos = 0;
  return (
    <>
      {ws.map((w, k) => {
        const start = pos; pos += w.length + 1;
        const u = hit && start >= hit.i && start < hit.i + hit.e.length;
        const dim = upto != null && k >= upto;
        return <span key={k} className={`${u ? 'u' : ''}${dim ? ' dim' : ''}`}>{w}{k < ws.length - 1 ? ' ' : ''}</span>;
      })}
    </>
  );
}

type Line = { who: 'ai' | 'me'; en: string; ko?: string; good?: boolean; flag?: boolean; turn: number; at: number };
const hm = (t: number) => new Date(t).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });

export function Call() {
  const [scene, setScene] = useState<Scene>(SCENES[0]);
  const [live, setLive] = useState(false);
  const [done, setDone] = useState<{ lines: Line[]; secs: number } | null>(null);
  const [pick, setPick] = useState(false);
  const [more, setMore] = useState(false);
  const { toast } = useUi();
  if (done) return <Summary scene={scene} lines={done.lines} secs={done.secs} onClose={() => setDone(null)} />;
  if (live) return <Live scene={scene} onEnd={(lines, secs) => { setLive(false); setDone({ lines, secs }); }} />;
  return (
    <section className="screen call-home">
      <div className="ch-center">
        <h1>{scene.who}</h1>
        <p className="ch-scene">{tt(scene.title)}</p>
        <small className="ch-in">{tt('전화가 왔어요')}</small>
      </div>
      <div className="ch-bottom">
        <div className="ch-mission">
          <span>{tt('이번 통화에서 써 볼 표현')}</span>
          <div>{scene.mission.map((m) => <i key={m} lang="en">{m}</i>)}</div>
        </div>
        <div className="ch-icons">
          <button onClick={() => setPick(true)}>
            <span><svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h10M5 18h7" /></svg></span>{tt('상황 바꾸기')}
          </button>
          <button onClick={() => setMore(true)}>
            <span><svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18" cy="12" r="1.4" /></svg></span>{tt('더 보기')}
          </button>
        </div>
        <Slide label={tt('밀어서 받기')} onGo={() => setLive(true)} />
      </div>
      {more && (
        <div className="ch-sheet" onClick={() => setMore(false)}>
          <div className="in" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setMore(false); toast(tt('매일 정한 시간에 전화가 오는 기능은 준비 중이에요')); }}><span className="tx"><b>{tt('매일 전화 알람')}</b><small>{tt('정한 시간에 Samantha가 먼저 전화해요')}</small></span></button>
            <button onClick={() => { setMore(false); toast(tt('목소리·속도 설정은 준비 중이에요')); }}><span className="tx"><b>{tt('설정')}</b><small>{tt('목소리 · 말하는 속도')}</small></span></button>
          </div>
        </div>
      )}
      {pick && (
        <div className="ch-sheet" onClick={() => setPick(false)}>
          <div className="in" onClick={(e) => e.stopPropagation()}>
            <b>{tt('{w}와 어떤 상황으로 통화할까요?', { w: scene.who })}</b>
            {SCENES.map((s) => (
              <button key={s.id} className={s.id === scene.id ? 'on' : ''} onClick={() => { setScene(s); setPick(false); }}>
                <span className="tx"><b>{tt(s.title)}</b><small>{tt(s.sub)}</small></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** 밀어서 받기 (눌러도 받는다) */
function Slide({ label, onGo }: { label: string; onGo: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const drag = useRef<{ x0: number; max: number } | null>(null);
  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x0: e.clientX, max: (track.current?.clientWidth ?? 300) - 82 };
  };
  const move = (e: React.PointerEvent) => { if (drag.current) setX(Math.min(drag.current.max, Math.max(0, e.clientX - drag.current.x0))); };
  const up = () => {
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (x < 6 || x > d.max * 0.7) { setX(d.max); setTimeout(onGo, 150); } else setX(0);
  };
  return (
    <div className="ch-slide" ref={track}>
      <span style={{ opacity: Math.max(0, 1 - x / 200) }}>{label}</span>
      <button className="knob" style={{ transform: `translateX(${x}px)` }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setX(0); }} aria-label={label}>
        <Icon name="phone" />
      </button>
    </div>
  );
}

function Live({ scene, onEnd }: { scene: Scene; onEnd: (lines: Line[], secs: number) => void }) {
  const { speak } = useUi();
  const [k, setK] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [left, setLeft] = useState(LIMIT);
  const [phase, setPhase] = useState<'ring' | 'ai' | 'me' | 'check'>('ring');
  const [reveal, setReveal] = useState(99);
  const [heard, setHeard] = useState('');
  const [listening, setListening] = useState(false);
  const [micErr, setMicErr] = useState('');
  const [say, setSay] = useState('');
  const [help, setHelp] = useState(false);
  const [native, setNative] = useState<number | null>(null);
  const [hideKo, setHideKo] = useState(false);
  const [peek, setPeek] = useState<number[]>([]); // 가린 상태에서 하나씩 눌러 본 뜻
  const used = useMemo(() => scene.mission.filter((m) => lines.some((l) => l.who === 'me' && l.en.toLowerCase().includes(m))), [lines, scene.mission]);
  const rec = useRef<SpeechRec | null>(null);
  const asked = useRef(false);
  const heardRef = useRef('');
  const box = useRef<HTMLDivElement>(null);
  const linesRef = useRef(lines); linesRef.current = lines;
  const leftRef = useRef(left); leftRef.current = left;
  const turn = scene.turns[k];
  const finish = () => { rec.current?.abort(); hush(); onEnd(linesRef.current, LIMIT - leftRef.current); };

  useEffect(() => { const t = setInterval(() => setLeft((s) => s - 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (left <= 0) finish(); }, [left]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { rec.current?.abort(); hush(); }, []);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' }); }, [lines, reveal, heard, phase, native]);
  useEffect(() => { if (phase !== 'ring') return; const t = setTimeout(() => setPhase('ai'), 1500); return () => clearTimeout(t); }, [phase]);

  // AI가 말하는 동안 글자가 한 단어씩 따라 나온다
  useEffect(() => {
    if (phase !== 'ai' || !turn) return;
    setLines((l) => [...l, { who: 'ai', en: turn.ai, ko: turn.ko, turn: k, at: Date.now() }]);
    speak(turn.ai, 'en', { quiet: true });
    const n = turn.ai.split(' ').length, ms = talkMs(turn.ai);
    setReveal(0);
    const iv = setInterval(() => setReveal((r) => Math.min(n, r + 1)), ms / n);
    const t = setTimeout(() => { clearInterval(iv); setReveal(n); setPhase('me'); setHelp(false); setSay(''); setHeard(''); heardRef.current = ''; if (asked.current) listen(); }, ms + 300);
    return () => { clearInterval(iv); clearTimeout(t); };
  }, [phase, k]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (said: string) => {
    rec.current?.abort();
    setListening(false);
    if (!said.trim()) return;
    const good = turn.replies.some((r) => closeness(said, r.en) >= 0.5);
    setLines((l) => [...l, { who: 'me', en: said.trim(), good, turn: k, at: Date.now() }]);
    setHeard(''); heardRef.current = '';
    setPhase('check');
    setTimeout(() => {
      if (k + 1 < scene.turns.length) { setK(k + 1); setPhase('ai'); }
      else setTimeout(finish, 900);
    }, 1400);
  };

  const listen = async () => {
    if (!Recognition || micErr) return;
    hush(); // 상대 목소리가 마이크에 섞이지 않게
    if (!asked.current && navigator.mediaDevices?.getUserMedia) {
      try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }); st.getTracks().forEach((t) => t.stop()); }
      catch { setMicErr('not-allowed'); setHelp(true); return; }
    }
    asked.current = true;
    const r = new Recognition();
    r.lang = 'en-US';
    r.interimResults = true;
    r.continuous = true; // 보내기(↑)를 누를 때까지 계속 듣는다
    r.onresult = (e) => { const t = Array.from(e.results).map((x) => x[0].transcript).join(' '); heardRef.current = t; setHeard(t); };
    r.onend = () => setListening(false);
    r.onerror = (e) => {
      setListening(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') { setMicErr(e.error); setHelp(true); }
      else if (e.error === 'no-speech') setSay(tt('아무 말도 안 들렸어요. 마이크를 눌러 다시 말해 보세요'));
      else if (e.error === 'network') setSay(tt('말 인식에 인터넷 연결이 필요해요'));
      else if (e.error !== 'aborted') setSay(tt('말을 알아듣지 못했어요 ({e})', { e: e.error }));
    };
    rec.current = r;
    try { r.start(); setListening(true); setSay(''); } catch { setListening(false); }
  };
  const send = () => { rec.current?.stop(); setTimeout(() => answer(heardRef.current), 250); };
  const cancel = () => { rec.current?.abort(); setHeard(''); heardRef.current = ''; setTimeout(listen, 200); };
  const retry = (i: number) => { setLines((l) => l.slice(0, i)); setPhase('me'); setHeard(''); heardRef.current = ''; listen(); };
  const flag = (i: number) => setLines((l) => l.map((x, j) => (j === i ? { ...x, flag: !x.flag } : x)));

  const lastMe = lines.map((l) => l.who).lastIndexOf('me');
  const myTurn = phase === 'me' && !heard;
  return (
    <section className="screen call-live">
      <div className="cl-head">
        <button className="x" aria-label={tt('끊기')} onClick={finish}><Icon name="close" /></button>
        <div><small className={left <= 30 ? 'warn' : ''}>{phase === 'ring' ? tt('연결 중…') : mmss(left)}</small><b>{scene.who}</b></div>
        <button className={`ko${hideKo ? ' off' : ''}`} aria-label={hideKo ? tt('번역 보이기') : tt('번역 가리기')} onClick={() => { setHideKo(!hideKo); setPeek([]); }}><Icon name={hideKo ? 'eyeOff' : 'eye'} /></button>
      </div>
      <div className="cl-mission">{scene.mission.map((m) => <i key={m} lang="en" className={used.includes(m) ? 'on' : ''}>{used.includes(m) && <Icon name="check" />}{m}</i>)}</div>

      <div className="cl-talk" ref={box}>
        {phase === 'ring' && <div className="cl-ring"><span className="av">{scene.who[0]}</span><small>{tt('전화 거는 중…')}</small></div>}
        {lines.map((l, i) => {
          const speaking = i === lines.length - 1 && phase === 'ai';
          const showSide = !speaking;
          return l.who === 'ai' ? (
            <div key={i} className="cl-ai">
              <span className="av">{scene.who[0]}</span>
              <div className="col">
                <small className="nm">{scene.who}</small>
                <div className="line">
                  <div className="bub">
                    <p lang="en"><Marked text={l.en} upto={speaking ? reveal : undefined} /></p>
                    {showSide && (hideKo && !peek.includes(i)
                      ? <button className="see-ko" aria-label={tt('뜻 보기')} onClick={() => setPeek((p) => [...p, i])}>{l.ko}</button>
                      : <small className="ko">{l.ko}</small>)}
                  </div>
                  {showSide && (
                    <div className="side">
                      <button className={`fl${l.flag ? ' on' : ''}`} aria-label={tt('표현 담기')} onClick={() => flag(i)}><Flag /></button>
                      <small className="tm">{hm(l.at)}</small>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div key={i} className="cl-me">
              <div className="line">
                <div className="side">
                  {i === lastMe && phase === 'check'
                    ? <button aria-label={tt('다시 말하기')} onClick={() => retry(i)}><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" /></svg></button>
                    : <small className={`res${l.good ? ' good' : ''}`}>{l.good ? tt('완벽해요!') : tt('잘 통했어요')}</small>}
                  <small className="tm">{hm(l.at)}</small>
                </div>
                <div className="bub"><p lang="en">{l.en}</p></div>
              </div>
              {!l.good && (i !== lastMe || phase !== 'check') && (
                native === i
                  ? <div className="nat"><small>{tt('원어민스러운 문장')}</small><p lang="en">{scene.turns[l.turn].replies[0].en}</p><small>{scene.turns[l.turn].replies[0].ko}</small></div>
                  : <button className="pill" onClick={() => setNative(i)}><Spark />{tt('원어민스러운 문장')}</button>
              )}
            </div>
          );
        })}
        {phase === 'me' && heard && <div className="cl-me live"><div className="line"><div className="bub"><p lang="en">{heard}</p></div></div></div>}
        {myTurn && !help && (
          <div className="cl-me"><button className="cl-ask" onClick={() => setHelp(true)}><Icon name="bulb" />{tt('뭐라고 하지?')}</button></div>
        )}
        {myTurn && help && (
          <div className="cl-picks">
            {micErr && <small>{tt('마이크를 쓸 수 없어요. 대답을 골라 주세요')}</small>}
            {turn.replies.map((r) => <button key={r.en} onClick={() => answer(r.en)}><b lang="en">{r.en}</b><small>{r.ko}</small></button>)}
          </div>
        )}
        {phase === 'check' && <div className="cl-typing"><span className="av">{scene.who[0]}</span><div className="bub"><i /><i /><i /></div></div>}
      </div>

      {phase === 'ai' && (
        <div className="cl-speak">
          <div className="bars">{[0.1, 0.35, 0.2, 0.5, 0.05, 0.3, 0.15].map((d, j) => <i key={j} style={{ animationDelay: `${d}s` }} />)}</div>
          {tt('{w}가 말하는 중', { w: scene.who })}
        </div>
      )}
      {phase === 'me' && Recognition && !micErr && (
        <div className="cl-bar">
          {listening && <div className="dots">{Array.from({ length: 20 }, (_, j) => <i key={j} style={{ animationDelay: `${j * 0.06}s` }} />)}</div>}
          <button className={`mic${listening ? ' on' : ''}`} aria-label={listening ? tt('보내기') : tt('말하기')} onClick={listening ? send : listen}>
            {listening ? <svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6" /></svg> : <Icon name="mic" />}
          </button>
          <small className="cl-say">{say || (listening ? tt('다 말하면 가운데를 눌러 보내요') : tt('마이크를 누르고 영어로 대답해요'))}</small>
          {listening && <button className="ghost" onClick={cancel}>{tt('지우고 다시')}</button>}
        </div>
      )}
    </section>
  );
}

const Flag = () => <svg viewBox="0 0 24 24"><path d="M5 21V4h11l-2 4 2 4H5" /></svg>;
const Spark = () => <svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>;

function Summary({ scene, lines, secs, onClose }: { scene: Scene; lines: Line[]; secs: number; onClose: () => void }) {
  const mine = lines.filter((l) => l.who === 'me');
  const good = mine.filter((l) => l.good).length;
  const flagged = useMemo(() => lines.filter((l) => l.flag), [lines]);
  return (
    <section className="screen call-sum">
      <div className="cs-body">
        <span className="av big">{scene.who[0]}</span>
        <h2>{tt('{w}와 통화 끝!', { w: scene.who })}</h2>
        <p className="cs-meta">{tt(scene.title)} · {mmss(secs)} · {tt('내가 한 말 {n}번', { n: mine.length })}</p>
        <div className="cs-mission">{scene.mission.map((m) => { const ok = mine.some((l) => l.en.toLowerCase().includes(m)); return <i key={m} className={ok ? 'on' : ''} lang="en">{ok && <Icon name="check" />}{m}</i>; })}</div>
        <div className="cs-score"><b>{good}</b> / {mine.length || scene.turns.length}<small>{tt('자연스럽게 대답했어요')}</small></div>
        {flagged.length > 0 && (
          <>
            <b className="ch-lbl">{tt('담은 표현')}</b>
            <div className="cs-list">{flagged.map((l, i) => <div key={i} className="cs-row"><p lang="en">{l.en}</p>{l.ko && <small className="ko">{l.ko}</small>}</div>)}</div>
          </>
        )}
        <b className="ch-lbl">{tt('대화 다시 보기')}</b>
        <div className="cs-list">
          {lines.map((l, i) => (
            <div key={i} className={`cs-row ${l.who}`}>
              <small>{l.who === 'ai' ? scene.who : tt('나')}</small>
              <p lang="en">{l.en}</p>
              {l.ko && <small className="ko">{l.ko}</small>}
              {l.who === 'me' && !l.good && <small className="tip">{tt('이렇게도 말할 수 있어요')}: <b lang="en">{scene.turns[l.turn].replies[0].en}</b></small>}
            </div>
          ))}
        </div>
      </div>
      <div className="foot"><Button kind="dark" style={{ minHeight: 52 }} onClick={onClose}>{tt('확인')}</Button></div>
    </section>
  );
}
