import { useEffect, useMemo, useRef, useState } from 'react';
import { tt } from '../i18n';
import { Icon } from '../components/Icon';
import { CARDS } from '../data';
import { stopAudio } from '../lib/audio';
import { speechOk } from '../lib/speech';
import { useUi } from '../ui';
import { useActions } from '../lib/useActions';
import type { Card } from '../types';
import CALLS from '../data/calls.json';

// shortcut: 진짜 AI가 아니라 정해 둔 대본(data/calls.json)으로 통화한다. AI 대화를 붙이려면 서버와 언어 모델 API가 필요하다
// AI 대사 음성은 tools/audio/gen_call.py로 미리 만들어 public/audio에 넣는다(없으면 기기 음성)
type Turn = { ai: string; ko: string; replies: { en: string; ko: string }[] };
type Scene = { id: string; title: string; who: string; role: string; group: string; sub: string; voice: string; mission: string[]; missionKo: string[]; level: string; mins: number; turns: Turn[] };
const SCENES = CALLS as Scene[];
// 더 보기에서 바꾸는 통화 설정 (이 기기에만 저장)
type Opts = { hideKo: boolean; slow: boolean; hint: boolean; mins: 3 | 5 };
const OPT_KEY = 'call-opts';
const DAY_KEY = 'call-today';
const today = () => new Date().toDateString();
/** 오늘 건 AI 전화 횟수 (마이 화면에서 보여 줌) */
export const callsToday = (): number => { try { const v = JSON.parse(localStorage.getItem(DAY_KEY) || '{}'); return v.d === today() ? v.n : 0; } catch { return 0; } };
/** 무료로 하루에 걸 수 있는 횟수 (지금은 세기만 하고 막지 않음) */
export const FREE_CALLS = 3;
const DONE_KEY = 'call-done';
const doneScenes = (): string[] => { try { return JSON.parse(localStorage.getItem(DONE_KEY) || '[]'); } catch { return []; } };
const markDone = (id: string) => { try { localStorage.setItem(DONE_KEY, JSON.stringify([...new Set([...doneScenes(), id])])); } catch { /* 표시만 못 함 */ } };
const bumpCall = () => { try { localStorage.setItem(DAY_KEY, JSON.stringify({ d: today(), n: callsToday() + 1 })); } catch { /* 못 세도 통화는 됨 */ } };
const DEF: Opts = { hideKo: false, slow: false, hint: false, mins: 3 };
const loadOpts = (): Opts => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(OPT_KEY) || '{}') }; } catch { return DEF; } };
const SCENE_ICON: Record<string, JSX.Element> = {
  late: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>,
  cafe: <svg viewBox="0 0 24 24"><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3" /></svg>,
  work: <svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></svg>,
};

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

// how: 마이크로 말함 / 키보드로 씀 / 추천 대답을 그냥 보냄 (결과에서 따로 센다)
type Line = { who: 'ai' | 'me'; en: string; ko?: string; good?: boolean; how?: 'said' | 'typed' | 'picked'; flag?: boolean; turn: number; at: number };
const hm = (t: number) => new Date(t).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });

export function Call() {
  const [scene, setScene] = useState<Scene>(SCENES[0]);
  const [live, setLive] = useState(false);
  const [done, setDone] = useState<{ lines: Line[]; secs: number } | null>(null);
  const [pick, setPick] = useState(false);
  const [more, setMore] = useState(false);
  const [opts, setOpts0] = useState<Opts>(loadOpts);
  const setOpts = (p: Partial<Opts>) => setOpts0((o) => { const n = { ...o, ...p }; try { localStorage.setItem(OPT_KEY, JSON.stringify(n)); } catch { /* 저장 못 해도 이번엔 적용 */ } return n; });
  const { toast, speak } = useUi();
  const leftCalls = Math.max(0, FREE_CALLS - callsToday());
  if (done) return <Summary scene={scene} lines={done.lines} secs={done.secs} onClose={() => setDone(null)} onAgain={() => { setDone(null); bumpCall(); setLive(true); }} />;
  if (live) return <Live scene={scene} opts={opts} onEnd={(lines, secs) => { setLive(false); markDone(scene.id); setDone({ lines, secs }); }} />;
  return (
    <section className="screen call-home">
      <div className="ch-center">
        <h1>{scene.who}</h1>
        <p className="ch-scene">{tt(scene.title)} · {tt('{r} 역할', { r: tt(scene.role) })}</p>
        <div className="ch-meta"><i>{tt(scene.level)}</i><i>{tt('약 {n}분', { n: scene.mins })}</i><i className="b">{leftCalls ? tt('오늘 {n}번 남음', { n: leftCalls }) : tt('오늘 무료 통화 다 씀')}</i></div>
        <small className="ch-in">{tt('전화가 왔어요')}</small>
      </div>
      <div className="ch-mission">
        <span>{tt('이번 통화에서 써 볼 표현')}</span>
        <ul>{scene.mission.map((m, i) => (
          <li key={m}><span><b lang="en">{m}</b><small>{scene.missionKo[i]}</small></span><button aria-label={tt('듣기')} onClick={() => speak(m, 'en')}><PlayI /></button></li>
        ))}</ul>
      </div>
      <div className="ch-bottom">
        <div className="ch-icons">
          <button onClick={() => setPick(true)}>
            <span><svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h10M5 18h7" /></svg></span>{tt('상황 바꾸기')}
          </button>
          <button onClick={() => setMore(true)}>
            <span><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></svg></span>{tt('통화 설정')}
          </button>
        </div>
        <Slide label={tt('밀어서 받기')} onGo={() => { bumpCall(); setLive(true); }} />
      </div>
      {more && (
        <div className="ch-sheet" onClick={() => setMore(false)}>
          <div className="in pick" onClick={(e) => e.stopPropagation()}>
            <i className="grab" />
            <div className="ttl"><b>{tt('통화 설정')}</b><small>{tt('다음 통화부터 적용돼요')}</small></div>
            <div className="co-list">
              <button className="co" onClick={() => setOpts({ hideKo: !opts.hideKo })}>
                <span className="tx"><b>{tt('번역 가리고 시작')}</b><small>{tt('뜻을 가린 채 듣고, 필요할 때만 눌러 봐요')}</small></span>
                <span className={`co-sw${opts.hideKo ? ' on' : ''}`} />
              </button>
              <button className="co" onClick={() => setOpts({ hint: !opts.hint })}>
                <span className="tx"><b>{tt('추천 대답 먼저 보기')}</b><small>{tt('내 차례마다 대답 예시를 바로 펼쳐 둬요')}</small></span>
                <span className={`co-sw${opts.hint ? ' on' : ''}`} />
              </button>
              <div className="co">
                <span className="tx"><b>{tt('말하는 속도')}</b><small>{tt('Samantha가 말하는 빠르기')}</small></span>
                <span className="co-seg">{([[false, '보통'], [true, '천천히']] as const).map(([v, t]) => <button key={t} className={opts.slow === v ? 'on' : ''} onClick={() => setOpts({ slow: v })}>{tt(t)}</button>)}</span>
              </div>
              <div className="co">
                <span className="tx"><b>{tt('통화 시간')}</b><small>{tt('시간이 다 되면 통화가 끝나요')}</small></span>
                <span className="co-seg">{([3, 5] as const).map((m) => <button key={m} className={opts.mins === m ? 'on' : ''} onClick={() => setOpts({ mins: m })}>{tt('{n}분', { n: m })}</button>)}</span>
              </div>
              <button className="co dim" onClick={() => toast(tt('매일 정한 시간에 전화가 오는 기능은 준비 중이에요'))}>
                <span className="tx"><b>{tt('매일 전화 알람')}</b><small>{tt('정한 시간에 Samantha가 먼저 전화해요')}</small></span>
                <span className="co-soon">{tt('준비 중')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {pick && (
        <div className="ch-sheet" onClick={() => setPick(false)}>
          <div className="in pick" onClick={(e) => e.stopPropagation()}>
            <i className="grab" />
            <div className="ttl"><b>{tt('통화 상황 고르기')}</b><small>{tt('Samantha가 상황에 맞는 역할로 전화해요')}</small></div>
            {[...new Set(SCENES.map((s) => s.group))].map((g) => (
              <div key={g} className="grp">
                <small className="gl">{tt(g)}</small>
                {SCENES.filter((s) => s.group === g).map((s) => (
                  <button key={s.id} className={`it${s.id === scene.id ? ' on' : ''}`} onClick={() => { setScene(s); setPick(false); }}>
                    <span className="ic">{SCENE_ICON[s.id]}</span>
                    <span className="tx"><b>{tt(s.title)}</b><small className="tags"><i>{tt('{r} 역할', { r: tt(s.role) })}</i><i className={s.level === '쉬움' ? 'ez' : 'md'}>{tt(s.level)}</i><i>{tt('약 {n}분', { n: s.mins })}</i>{doneScenes().includes(s.id) && <i className="dn">✓ {tt('해 봄')}</i>}</small></span>
                    <span className="ck">{s.id === scene.id && <Icon name="check" />}</span>
                  </button>
                ))}
              </div>
            ))}
            <div className="soon">{tt('곧 추가 · 길 묻기, 호텔 체크인, 병원 예약')}</div>
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

function Live({ scene, opts, onEnd }: { scene: Scene; opts: Opts; onEnd: (lines: Line[], secs: number) => void }) {
  const LIMIT = opts.mins * 60;
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
  const [hideKo, setHideKo] = useState(opts.hideKo);
  const [peek, setPeek] = useState<number[]>([]); // 가린 상태에서 하나씩 눌러 본 뜻
  const [practice, setPractice] = useState<{ en: string; ko: string } | null>(null); // 고른 대답을 따라 말해 보는 중
  const [typing, setTyping] = useState(!Recognition);
  const [typed, setTyped] = useState('');
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
    speak(turn.ai, 'en', { quiet: true, rate: opts.slow ? 0.7 : undefined });
    const n = turn.ai.split(' ').length, ms = talkMs(turn.ai) * (opts.slow ? 1.45 : 1);
    setReveal(0);
    const iv = setInterval(() => setReveal((r) => Math.min(n, r + 1)), ms / n);
    const t = setTimeout(() => { clearInterval(iv); setReveal(n); setPhase('me'); setHelp(opts.hint); setSay(''); setHeard(''); heardRef.current = ''; if (asked.current && !typing) listen(); }, ms + 300);
    return () => { clearInterval(iv); clearTimeout(t); };
  }, [phase, k]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (said: string, how: 'said' | 'typed' | 'picked' = 'said') => {
    rec.current?.abort();
    setListening(false);
    if (!said.trim()) return;
    const good = how !== 'picked' && turn.replies.some((r) => closeness(said, r.en) >= 0.5);
    setLines((l) => [...l, { who: 'me', en: said.trim(), good, how, turn: k, at: Date.now() }]);
    setHeard(''); heardRef.current = ''; setPractice(null); setTyped('');
    setPhase('check');
    setTimeout(() => {
      if (k + 1 < scene.turns.length) { setK(k + 1); setPhase('ai'); }
      else setTimeout(finish, 900);
    }, 1400);
  };

  const listen = async (force = false) => {
    if (!Recognition || (micErr && !force)) return;
    hush(); // 상대 목소리가 마이크에 섞이지 않게
    if (!asked.current && navigator.mediaDevices?.getUserMedia) {
      try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }); st.getTracks().forEach((t) => t.stop()); }
      catch { setMicErr('not-allowed'); setTyping(true); return; }
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
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') { setMicErr(e.error); setTyping(true); }
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
  const retryMic = () => { setMicErr(''); setTyping(false); asked.current = false; listen(true); };
  const flag = (i: number) => setLines((l) => l.map((x, j) => (j === i ? { ...x, flag: !x.flag } : x)));

  const lastMe = lines.map((l) => l.who).lastIndexOf('me');
  const lastAi = lines.map((l) => l.who).lastIndexOf('ai');
  const canMic = !!Recognition && !micErr;
  const myTurn = phase === 'me' && !heard;
  return (
    <section className="screen call-live">
      <div className="cl-head">
        <span className="sp" />
        <div><small className={left <= 30 ? 'warn' : ''}>{phase === 'ring' ? tt('연결 중…') : mmss(left)}</small><b>{scene.who}</b></div>
        <button className={`ko${hideKo ? ' off' : ''}`} aria-label={hideKo ? tt('번역 보이기') : tt('번역 가리기')} onClick={() => { setHideKo(!hideKo); setPeek([]); }}><Icon name={hideKo ? 'eyeOff' : 'eye'} /></button>
      </div>
      <div className="cl-mission">{scene.mission.map((m) => <i key={m} lang="en" className={used.includes(m) ? 'on' : ''}>{used.includes(m) && <Icon name="check" />}{m}</i>)}<b className="cnt">{used.length}/{scene.mission.length}</b></div>

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
                      <button className={`fl${l.flag ? ' on' : ''}`} aria-label={tt('표현 담기')} onClick={() => flag(i)}><Icon name="mark" /></button>
                      <small className="tm">{hm(l.at)}</small>
                    </div>
                  )}
                </div>
                {i === lastAi && showSide && (
                  <div className="cl-replay">
                    <button onClick={() => speak(l.en, 'en')}><PlayI />{tt('다시 듣기')}</button>
                    <button onClick={() => speak(l.en, 'en', { rate: 0.7 })}>{tt('천천히')}</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div key={i} className="cl-me">
              <div className="line">
                <div className="side">
                  {i === lastMe && phase === 'check'
                    ? <button aria-label={tt('다시 말하기')} onClick={() => retry(i)}><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" /></svg></button>
                    : <small className={`res${l.how === 'picked' ? ' pk' : l.good ? ' good' : ''}`}>{l.how === 'picked' ? tt('골라서 보냄') : l.good ? tt('완벽해요!') : tt('잘 통했어요')}</small>}
                  <small className="tm">{hm(l.at)}</small>
                </div>
                <div className="bub"><p lang="en">{l.en}</p></div>
              </div>
              {!l.good && l.how !== 'picked' && (i !== lastMe || phase !== 'check') && (
                native === i
                  ? <div className="nat"><small>{tt('원어민스러운 문장')}</small><p lang="en">{scene.turns[l.turn].replies[0].en}</p><small>{scene.turns[l.turn].replies[0].ko}</small></div>
                  : <button className="pill" onClick={() => setNative(i)}><Spark />{tt('원어민스러운 문장')}</button>
              )}
            </div>
          );
        })}
        {phase === 'me' && heard && <div className="cl-me live"><div className="line"><div className="bub"><p lang="en">{heard}</p></div></div></div>}
        {myTurn && !help && !practice && (
          <div className="cl-me"><button className="cl-ask" onClick={() => setHelp(true)}><Icon name="bulb" />{tt('뭐라고 하지?')}</button></div>
        )}
        {myTurn && help && !practice && (
          <div className="cl-picks">
            {turn.replies.map((r) => <button key={r.en} onClick={() => { setPractice(r); setHelp(false); }}><b lang="en">{r.en}</b><small>{r.ko}</small></button>)}
          </div>
        )}
        {myTurn && practice && (
          <div className="cl-prac">
            <small>{tt('이렇게 말해 보세요')}</small>
            <b lang="en">{practice.en}</b>
            <p>{practice.ko}</p>
            <div className="pacts">
              <button onClick={() => speak(practice.en, 'en')}><PlayI />{tt('듣기')}</button>
              <button onClick={() => speak(practice.en, 'en', { rate: 0.7 })}>{tt('천천히')}</button>
            </div>
            <button className="skip" onClick={() => answer(practice.en, 'picked')}>{tt('그냥 보내기 (연습 안 함)')}</button>
          </div>
        )}
        {phase === 'me' && micErr && (
          <div className="cl-warn"><span><b>{tt('마이크를 쓸 수 없어요')}</b><small>{tt('마이크를 허용하거나 키보드로 써 주세요')}</small></span><button onClick={retryMic}>{tt('다시 시도')}</button></div>
        )}
        {phase === 'check' && <div className="cl-typing"><span className="av">{scene.who[0]}</span><div className="bub"><i /><i /><i /></div></div>}
      </div>

      <button className="cl-end" aria-label={tt('통화 종료')} onClick={finish}><Icon name="phone" /><small>{tt('종료')}</small></button>
      {phase === 'me' && (canMic || !typing) && (
        <button className="cl-kb" aria-label={typing ? tt('말하기') : tt('키보드로 쓰기')} onClick={() => { rec.current?.abort(); setListening(false); setTyping(!typing); }}>
          {typing ? <Icon name="mic" /> : <svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h1M11 10h2M16 10h1M8 14h8" /></svg>}
          <small>{typing ? tt('말하기') : tt('키보드')}</small>
        </button>
      )}
      {phase === 'me' && typing && (
        <form className="cl-type" onSubmit={(e) => { e.preventDefault(); answer(typed, 'typed'); }}>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={tt('영어로 써 보세요')} lang="en" autoFocus autoComplete="off" />
          <button type="submit" aria-label={tt('보내기')} disabled={!typed.trim()}><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
        </form>
      )}
      {phase === 'ai' && (
        <div className="cl-speak">
          <div className="bars">{[0.1, 0.35, 0.2, 0.5, 0.05, 0.3, 0.15].map((d, j) => <i key={j} style={{ animationDelay: `${d}s` }} />)}</div>
          {tt('{w}가 말하는 중', { w: scene.who })}
        </div>
      )}
      {phase === 'me' && canMic && !typing && (
        <div className="cl-bar">
          {listening && <div className="dots">{Array.from({ length: 20 }, (_, j) => <i key={j} style={{ animationDelay: `${j * 0.06}s` }} />)}</div>}
          <button className={`mic${listening ? ' on' : ''}`} aria-label={listening ? tt('보내기') : tt('말하기')} onClick={listening ? send : () => listen()}>
            {listening ? <svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6" /></svg> : <Icon name="mic" />}
          </button>
          <small className="cl-say">{say || (listening ? tt('다 말하면 가운데를 눌러 보내요') : practice ? tt('마이크를 누르고 따라 말해 보세요') : tt('마이크를 누르고 영어로 대답해요'))}</small>
          {listening && <button className="ghost" onClick={cancel}>{tt('지우고 다시')}</button>}
        </div>
      )}
    </section>
  );
}

const PlayI = () => <svg className="play" viewBox="0 0 10 10"><path d="M1.5 0.5l8 4.5-8 4.5z" /></svg>;
const Spark = () => <svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>;

/** 다듬은 문장을 배울래요에 담을 수 있게 카드 모양으로 */
const asCard = (en: string, ko: string): Card => ({ id: `call-${en}`, lang: 'en', cat: '일상', words: en.split(' '), key: [], expr: '', tr: { ko }, mean: {} });

function Summary({ scene, lines, secs, onClose, onAgain }: { scene: Scene; lines: Line[]; secs: number; onClose: () => void; onAgain: () => void }) {
  const [view, setView] = useState(false);
  const { findSaved, toggleSave } = useActions();
  const mine = lines.filter((l) => l.who === 'me');
  const self = mine.filter((l) => l.how !== 'picked').length;
  const used = scene.mission.filter((m) => mine.some((l) => l.en.toLowerCase().includes(m)));
  const missed = scene.mission.map((m, i) => ({ m, ko: scene.missionKo[i] })).filter((x) => !used.includes(x.m));
  const fix = mine.filter((l) => !l.good && l.how !== 'picked').map((l) => ({ said: l.en, better: scene.turns[l.turn].replies[0] }));
  const early = mine.length < scene.turns.length; // 대본 끝까지 가기 전에 끊음
  if (view) return <Replay scene={scene} lines={lines} onBack={() => setView(false)} onAgain={onAgain} />;
  return (
    <section className="screen call-sum">
      <div className="cs-top"><button className="x" aria-label={tt('닫기')} onClick={onClose}><Icon name="close" /></button><b>{tt('통화 결과')}</b><span /></div>
      <div className="cs-body">
        <span className="cs-av">{scene.who[0]}</span>
        <h2>{early
          ? tt('{t} 만에 끊었어요', { t: secs >= 60 ? tt('{m}분 {s}초', { m: Math.floor(secs / 60), s: secs % 60 }) : tt('{s}초', { s: secs }) })
          : tt('{w}와 {t} 통화했어요', { w: scene.who, t: secs >= 60 ? tt('{m}분 {s}초', { m: Math.floor(secs / 60), s: secs % 60 }) : tt('{s}초', { s: secs }) })}</h2>
        <p className="cs-meta">{early && missed.length ? tt('괜찮아요. 미션 표현 {n}개가 남았어요', { n: missed.length }) : tt(scene.title)}</p>
        <div className="cs-stats">
          <div><b>{self}</b><small>{tt('직접 말함')}</small></div>
          <div><b>{mine.length - self}</b><small>{tt('골라서 보냄')}</small></div>
          <div><b>{used.length}/{scene.mission.length}</b><small>{tt('미션 표현')}</small></div>
        </div>
        {missed.length > 0 && (
          <div className="cs-card">
            <div className="hd"><b>{tt('아직 못 쓴 표현')}</b></div>
            {missed.map((x) => {
              const card = asCard(x.m, x.ko);
              const on = !!findSaved('s', card);
              return (
                <div key={x.m} className="cs-miss">
                  <span><b lang="en">{x.m}</b><small>{x.ko}</small></span>
                  <button className={on ? 'on' : ''} onClick={() => toggleSave('s', card)}>{on ? tt('담았어요') : tt('+ 배울래요')}</button>
                </div>
              );
            })}
          </div>
        )}
        {fix.map((f, i) => {
          const card = asCard(f.better.en, f.better.ko);
          const on = !!findSaved('s', card);
          return (
            <div key={i} className="cs-card">
              <div className="hd"><b>{tt('다듬어 볼 문장')}</b></div>
              <p className="said" lang="en">{f.said}</p>
              <p className="better" lang="en"><Icon name="check" />{f.better.en}</p>
              <small className="note">{f.better.ko} · {tt('이렇게 말하면 더 자연스러워요')}</small>
              <button className={`cs-save${on ? ' on' : ''}`} onClick={() => toggleSave('s', card)}>{on ? tt('배울래요에 담았어요') : tt('+ 배울래요에 담기')}</button>
            </div>
          );
        })}
      </div>
      <div className="cs-foot">
        <div className="two">
          <button className="ghost" onClick={() => setView(true)}>{tt('대화 다시 보기')}</button>
          <button className="blue" onClick={onAgain}>{early ? tt('이어서 다시 걸기') : tt('다시 걸기')}</button>
        </div>
        <button className="lnk" onClick={onClose}>{tt('확인')}</button>
      </div>
    </section>
  );
}

function Replay({ scene, lines, onBack, onAgain }: { scene: Scene; lines: Line[]; onBack: () => void; onAgain: () => void }) {
  const { speak } = useUi();
  const [tab, setTab] = useState<'all' | 'me' | 'flag'>('all');
  const shown = lines.map((l, i) => ({ l, i })).filter(({ l }) => tab === 'all' || (tab === 'me' ? l.who === 'me' : l.flag));
  return (
    <section className="screen call-sum">
      <div className="cs-top"><button className="x" aria-label={tt('뒤로')} onClick={onBack}><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg></button><b>{tt('대화 다시 보기')}</b><span /></div>
      <div className="cs-tabs">
        {([['all', '전체'], ['me', '내 말만'], ['flag', '담은 표현']] as const).map(([k, t]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{tt(t)}</button>)}
      </div>
      <div className="cs-body talk">
        {!shown.length && <p className="cs-empty">{tab === 'flag' ? tt('통화 중에 깃발을 누른 표현이 여기에 모여요') : tt('아직 내용이 없어요')}</p>}
        {shown.map(({ l, i }) => l.who === 'ai' ? (
          <div key={i} className="cl-ai">
            <span className="av">{scene.who[0]}</span>
            <div className="col"><div className="line">
              <div className="bub"><p lang="en"><Marked text={l.en} /></p><small className="ko">{l.ko}</small></div>
              <button className="cs-play" aria-label={tt('다시 듣기')} onClick={() => speak(l.en, 'en')}><svg viewBox="0 0 10 10"><path d="M1 0l8.5 5L1 10z" /></svg></button>
            </div></div>
          </div>
        ) : (
          <div key={i} className="cl-me">
            <div className="line"><div className="bub"><p lang="en">{l.en}</p></div></div>
            <small className={`cs-tag${l.good ? ' good' : ''}`}>{l.how === 'picked' ? tt('골라서 보냄') : l.good ? tt('자연스러워요') : `${tt('다듬기')}: ${scene.turns[l.turn].replies[0].en}`}</small>
          </div>
        ))}
      </div>
      <div className="cs-foot"><button className="blue full" onClick={onAgain}>{tt('같은 상황으로 다시 걸기')}</button></div>
    </section>
  );
}
