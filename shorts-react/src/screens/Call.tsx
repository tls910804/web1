import { useEffect, useRef, useState } from 'react';
import { tt, uiLang } from '../i18n';
import { Icon } from '../components/Icon';
import { CARDS } from '../data';
import { playSrc, setAudioMode, stopAudio } from '../lib/audio';
import { speechOk } from '../lib/speech';
import { useUi } from '../ui';
import { useActions } from '../lib/useActions';
import type { Card } from '../types';
import { CONTENT } from '../lib/content';
import CALLS from '../data/calls.json';
import { aiOn, aiReact } from '../lib/callAi';

// 통화의 뼈대는 정해 둔 대본(data/calls.json). 대본에 없는 말을 하면 AI 서버(ai-call-worker)가 한 문장으로 반응해요(서버 주소가 있을 때만)
// AI 대사 음성은 tools/audio/gen_call.py로 미리 만들어 public/audio에 넣는다(없으면 기기 음성)
type Turn = { ai: string; ko: string; replies: { en: string; ko: string }[] };
type Scene = { id: string; title: string; who: string; role: string; group: string; sub: string; voice: string; mission: string[]; missionKo: string[]; level: string; mins: number; turns: Turn[] };
const SCENES = (CONTENT.calls ?? CALLS) as Scene[]; // 예전에 받아 둔 내용엔 대본이 없을 수 있어요
// 더 보기에서 바꾸는 통화 설정 (이 기기에만 저장)
type Opts = { hideKo: boolean; slow: boolean; hint: boolean; mins: 3 | 5; ring: boolean; ringH: number; ringDays: number[] };
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
const DEF: Opts = { hideKo: false, slow: false, hint: false, mins: 3, ring: false, ringH: 20, ringDays: [1, 2, 3, 4, 5] };
const loadOpts = (): Opts => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(OPT_KEY) || '{}') }; } catch { return DEF; } };
// 깜짝 전화 (시안 G): 서버 없이 동작해서, 정한 요일·시각이 지난 뒤 앱을 열어 두면 하루 한 번 전화가 와요
const RANG_KEY = 'call-rang';
const DAYS: [number, string][] = [[1, '월'], [2, '화'], [3, '수'], [4, '목'], [5, '금'], [6, '토'], [0, '일']];
const RING_H: [number, string][] = [[8, '아침 8시'], [12, '점심 12시'], [20, '저녁 8시']];
const ringDue = () => {
  const o = loadOpts(), d = new Date();
  try { if (localStorage.getItem(RANG_KEY) === today()) return false; } catch { return false; }
  return o.ring && o.ringDays.includes(d.getDay()) && d.getHours() >= o.ringH;
};
const answered = { now: false }; // 받기를 누르면 AI 전화 화면이 바로 통화를 시작해요
const SCENE_ICON: Record<string, JSX.Element> = {
  late: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>,
  cafe: <svg viewBox="0 0 24 24"><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3" /></svg>,
  work: <svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></svg>,
};

type Rec = { new (): SpeechRec };
interface SpeechRec { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null; start(): void; stop(): void; abort(): void }
const W = window as unknown as { SpeechRecognition?: Rec; webkitSpeechRecognition?: Rec };
const Recognition = W.SpeechRecognition || W.webkitSpeechRecognition;

// 마이크가 안 될 때 원인별 안내 (getUserMedia 오류 이름 · 말 인식 오류 코드)
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const MAC = !IOS && /Mac/.test(navigator.platform);
const micMsg = (code: string): [string, string] => {
  if (code === 'NotAllowedError' || code === 'not-allowed' || code === 'PermissionDeniedError')
    return IOS ? [tt('마이크가 막혀 있어요'), tt('아이폰 설정 → 쓰는 브라우저(Chrome·Safari) → 마이크를 켜고, 이 페이지를 새로고침한 뒤 다시 시도를 눌러 주세요')]
      : [tt('마이크가 막혀 있어요'), tt('주소창 왼쪽 자물쇠(사이트 설정) → 마이크 "허용"으로 바꾼 뒤 다시 시도를 눌러 주세요') + (MAC ? ' ' + tt('맥이라면 시스템 설정 → 개인정보 보호 및 보안 → 마이크에서 Chrome도 켜 주세요') : '')];
  if (code === 'NotFoundError' || code === 'audio-capture' || code === 'DevicesNotFoundError')
    return [tt('마이크를 찾지 못했어요'), tt('이어폰·마이크가 연결돼 있는지, 컴퓨터 소리 설정의 입력 장치를 확인해 주세요')];
  if (code === 'NotReadableError' || code === 'TrackStartError')
    return [tt('마이크를 열 수 없어요'), tt('다른 앱(줌·디스코드 등)이 마이크를 쓰고 있거나') + (MAC ? ' ' + tt('맥 시스템 설정에서 Chrome 마이크가 꺼져 있어요') : ' ' + tt('기기 설정에서 브라우저 마이크가 꺼져 있어요'))];
  if (code === 'service-not-allowed') return IOS ? [tt('말 인식이 꺼져 있어요'), tt('마이크 버튼을 눌러 다시 말해 보세요. 그래도 안 되면 아이폰 설정 → 일반 → 키보드 → 받아쓰기 활성화를 켜 주세요')]
    : [tt('이 브라우저는 말 인식을 막고 있어요'), tt('컴퓨터·안드로이드의 크롬이나 사파리에서 써 주세요')];
  if (code === 'no-recognition') return [tt('이 브라우저는 말 인식이 안 돼요'), tt('아이폰은 사파리, 컴퓨터·안드로이드는 크롬에서 말로 대답할 수 있어요. 지금은 키보드로 써 주세요')];
  if (code === 'insecure') return [tt('보안 연결(https)에서만 마이크를 쓸 수 있어요'), tt('https 주소로 열어 주세요')];
  return [tt('마이크를 쓸 수 없어요'), tt('마이크를 허용하거나 키보드로 써 주세요') + ` (${code})`];
};

// 아이폰은 사용자가 누른 순간에만 마이크 허용 창을 띄워요. 통화 받기(밀기)를 놓는 순간 미리 물어봐요
const askMic = () => {
  setAudioMode('play-and-record');
  if (Recognition && window.isSecureContext && navigator.mediaDevices?.getUserMedia)
    navigator.mediaDevices.getUserMedia({ audio: true }).then((st) => st.getTracks().forEach((t) => t.stop()), () => { /* 거절하면 통화 중에 안내가 떠요 */ });
};

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
type Line = { who: 'ai' | 'me'; en: string; ko?: string; audio?: string; /* AI 즉석 대사의 Chirp 음성 (다시 듣기용, 저장 안 함) */ good?: boolean; how?: 'said' | 'typed' | 'picked'; flag?: boolean; turn: number; at: number };
const hm = (t: number) => new Date(t).toLocaleTimeString(uiLang(), { hour: 'numeric', minute: '2-digit' });

export function Call() {
  const [scene, setScene] = useState<Scene>(SCENES[0]);
  const [live, setLive] = useState(false);
  const [done, setDone] = useState<{ lines: Line[]; secs: number } | null>(null);
  const [pick, setPick] = useState(false);
  const [more, setMore] = useState(false);
  const [showMission, setShowMission] = useState(false); // 써 볼 표현은 강요하지 않아요: 접어 두고 원할 때만
  const [opts, setOpts0] = useState<Opts>(loadOpts);
  const setOpts = (p: Partial<Opts>) => setOpts0((o) => { const n = { ...o, ...p }; try { localStorage.setItem(OPT_KEY, JSON.stringify(n)); } catch { /* 저장 못 해도 이번엔 적용 */ } return n; });
  const { speak } = useUi();
  const { logAct } = useActions();
  const call = () => { bumpCall(); logAct('c'); setLive(true); };
  const leftCalls = Math.max(0, FREE_CALLS - callsToday());
  useEffect(() => { if (answered.now) { answered.now = false; call(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (done) return <Summary scene={scene} lines={done.lines} secs={done.secs} onClose={() => setDone(null)} onAgain={() => { setDone(null); call(); }} />;
  if (live) return <Live scene={scene} opts={opts} onEnd={(lines, secs) => { setLive(false); markDone(scene.id); setDone({ lines, secs }); }} />;
  return (
    <section className="screen call-home">
      <div className="ch-center">
        <h1>{scene.who}</h1>
        <p className="ch-scene">{tt(scene.title)} · {tt('{r} 역할', { r: tt(scene.role) })}</p>
        <div className="ch-meta"><i>{tt(scene.level)}</i><i>{tt('약 {n}분', { n: scene.mins })}</i><i className="b">{leftCalls ? tt('오늘 {n}번 남음', { n: leftCalls }) : tt('오늘 무료 통화 다 씀')}</i></div>
        <small className="ch-in">{tt('전화가 왔어요')}</small>
      </div>
      <div className="ch-mid">
        {!doneScenes().length && (
          <div className="ch-safe"><b>{tt('처음이라면')}</b><small>{tt('1분이면 끝나요 · 틀려도 괜찮아요 · 막히면 글로 써도 돼요')}</small></div>
        )}
        <div className={`ch-mission${showMission ? ' open' : ''}`}>
          <button className="ch-fold" aria-expanded={showMission} onClick={() => setShowMission(!showMission)}>
            <span>{tt('써 볼 표현 · 선택')}</span><small>{showMission ? tt('접기') : tt('펼치기')} {showMission ? '▴' : '▾'}</small>
          </button>
          {showMission && <ul>{scene.mission.map((m, i) => (
            <li key={m}><span><b lang="en">{m}</b><small>{ko(scene.missionKo[i])}</small></span><button aria-label={tt('듣기')} onClick={() => speak(m, 'en')}><PlayI /></button></li>
          ))}</ul>}
        </div>
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
        <Slide label={tt('밀어서 받기')} onGo={call} />
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
              <button className="co" onClick={() => setOpts({ ring: !opts.ring })}>
                <span className="tx"><b>{tt('깜짝 전화')}</b><small>{tt('정한 시간에 Samantha가 먼저 전화해요')}</small></span>
                <span className={`co-sw${opts.ring ? ' on' : ''}`} />
              </button>
              {opts.ring && (
                <div className="co ring">
                  <span className="co-seg">{RING_H.map(([h, t]) => <button key={h} className={opts.ringH === h ? 'on' : ''} onClick={() => setOpts({ ringH: h })}>{tt(t)}</button>)}</span>
                  <span className="days">{DAYS.map(([d, t]) => (
                    <button key={d} className={opts.ringDays.includes(d) ? 'on' : ''} aria-pressed={opts.ringDays.includes(d)}
                      onClick={() => setOpts({ ringDays: opts.ringDays.includes(d) ? opts.ringDays.filter((x) => x !== d) : [...opts.ringDays, d] })}>{tt(t)}</button>
                  ))}</span>
                  <small>{tt('앱을 열어 두거나 그 시간이 지난 뒤 열면 전화가 와요 · 안 받으면 다음 날로 넘어가요')}</small>
                </div>
              )}
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

/** 깜짝 전화가 왔을 때 화면 위에 뜨는 카드 (App에서 항상 그려요) */
export function SurpriseCall() {
  const { screen, go } = useUi();
  const [show, setShow] = useState(false);
  const busy = ['splash', 'onboarding', 'call', 'review', 'study', 'streak'].includes(screen);
  useEffect(() => {
    if (busy) return;
    const check = () => { if (!document.hidden && ringDue()) { setShow(true); navigator.vibrate?.([300, 200, 300]); } };
    check();
    const t = setInterval(check, 60000);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', check); };
  }, [busy]);
  if (!show || busy) return null;
  const close = (take: boolean) => {
    try { localStorage.setItem(RANG_KEY, today()); } catch { /* 오늘 또 울릴 수 있음 */ }
    setShow(false);
    if (take) { answered.now = true; go('call'); }
  };
  return (
    <div className="sc-wrap" role="alertdialog" aria-label={tt('깜짝 전화')}>
      <div className="sc-card">
        <div className="sc-top">
          <i className="sc-av">S</i>
          <span><b>Samantha · {tt('문장 쇼츠')}</b><small>{tt('깜짝 전화가 왔어요 📞 오늘 배운 표현 써 볼까요?')}</small></span>
        </div>
        <div className="sc-btns">
          <button className="no" onClick={() => close(false)}>{tt('나중에')}</button>
          <button className="yes" onClick={() => close(true)}>{tt('받기')}</button>
        </div>
      </div>
    </div>
  );
}

/** 밀어서 받기 (눌러도 받는다) */
function Slide({ label, onGo }: { label: string; onGo: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const drag = useRef<{ x0: number; max: number } | null>(null);
  const down = (e: React.PointerEvent) => {
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* 이미 끝난 터치면 잡지 않아도 됨 */ }
    drag.current = { x0: e.clientX, max: (track.current?.clientWidth ?? 300) - 82 };
  };
  const move = (e: React.PointerEvent) => { if (drag.current) setX(Math.min(drag.current.max, Math.max(0, e.clientX - drag.current.x0))); };
  const up = () => {
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (x < 6 || x > d.max * 0.7) { askMic(); setX(d.max); setTimeout(onGo, 150); } else setX(0);
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
  const [micErr, setMicErr] = useState(Recognition ? '' : 'no-recognition');
  useEffect(() => () => setAudioMode('playback'), []); // 통화가 끝나면 재생 전용 모드로(카드 '딱' 소리 방지)
  const [say, setSay] = useState('');
  const [help, setHelp] = useState(false);
  const [hideKo, setHideKo] = useState(opts.hideKo);
  const [peek, setPeek] = useState<number[]>([]); // 가린 상태에서 하나씩 눌러 본 뜻
  const [practice, setPractice] = useState<{ en: string; ko: string } | null>(null); // 고른 대답을 따라 말해 보는 중
  const [typing, setTyping] = useState(!Recognition);
  const [typed, setTyped] = useState('');
  const rec = useRef<SpeechRec | null>(null);
  const asked = useRef(false);
  const heardRef = useRef('');
  const box = useRef<HTMLDivElement>(null);
  const linesRef = useRef(lines); linesRef.current = lines;
  const leftRef = useRef(left); leftRef.current = left;
  const turn = scene.turns[k];
  const aiNext = useRef<{ en: string; ko: string; audio: string } | null>(null); // AI가 만든 다음 대사 (있으면 대본 대사 대신)
  const finish = () => { rec.current?.abort(); hush(); onEnd(linesRef.current, LIMIT - leftRef.current); };

  useEffect(() => { const t = setInterval(() => setLeft((s) => s - 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (left <= 0) finish(); }, [left]); // eslint-disable-line react-hooks/exhaustive-deps
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; rec.current?.abort(); hush(); }; }, []);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' }); }, [lines, reveal, heard, phase]);
  useEffect(() => { if (phase !== 'ring') return; const t = setTimeout(() => setPhase('ai'), 1500); return () => clearTimeout(t); }, [phase]);

  // AI가 말하는 동안 글자가 한 단어씩 따라 나온다
  useEffect(() => {
    if (phase !== 'ai' || !turn) return;
    const o = aiNext.current; aiNext.current = null;
    const en = o?.en ?? turn.ai;
    setLines((l) => [...l, { who: 'ai', en, ko: o?.ko ?? turn.ko, audio: o?.audio, turn: k, at: Date.now() }]);
    if (o) playSrc(o.audio, opts.slow ? 0.7 : 1);
    else speak(turn.ai, 'en', { quiet: true, rate: opts.slow ? 0.7 : undefined }); // 첫인사·실패 시 대본: 미리 만든 음성 파일
    const n = en.split(' ').length, ms = talkMs(en) * (opts.slow ? 1.45 : 1);
    setReveal(0);
    const iv = setInterval(() => setReveal((r) => Math.min(n, r + 1)), ms / n);
    const t = setTimeout(() => { clearInterval(iv); setReveal(n); setPhase('me'); setHelp(opts.hint); setSay(''); setHeard(''); heardRef.current = ''; if (asked.current && !typing && !IOS) listen(); }, ms + 300); // 아이폰은 누른 순간에만 말 인식을 허락해서 자동으로 듣지 않아요(마이크 버튼)
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
    const next = () => {
      if (!alive.current) return;
      if (k + 1 < scene.turns.length) { setK(k + 1); setPhase('ai'); }
      else setTimeout(finish, 900);
    };
    // AI가 사용자 말에 반응하며 다음 대사를 직접 만들어요 (대본 다음 대사는 흐름 안내로만). 서버 없거나 실패하면 대본으로
    if (aiOn) {
      const history = [...linesRef.current, { who: 'me' as const, en: said.trim() }].map((l) => ({ who: l.who, en: l.en }));
      aiReact(scene, scene.turns[k + 1]?.ai ?? '', said.trim(), history).then((r) => {
        if (!alive.current) return;
        if (!r) { setTimeout(next, 600); return; }
        if (k + 1 < scene.turns.length) { aiNext.current = r; next(); return; }
        // 마지막: 작별 인사를 듣고 끊어요
        setLines((l) => [...l, { who: 'ai', en: r.en, ko: r.ko, audio: r.audio, turn: k, at: Date.now() }]);
        playSrc(r.audio, opts.slow ? 0.7 : 1);
        setTimeout(finish, talkMs(r.en) * (opts.slow ? 1.45 : 1) + 500);
      });
    } else setTimeout(next, 1400);
  };

  const listen = async (force = false) => {
    if (!Recognition || (micErr && !force)) return;
    hush(); // 상대 목소리가 마이크에 섞이지 않게
    if (!window.isSecureContext) { setMicErr('insecure'); setTyping(true); return; }
    setAudioMode('play-and-record');
    // 아이폰: 기다리면(await) '누른 순간'이 끊겨서 말 인식이 막혀요 → 미리 묻지 않고 바로 시작 (말 인식이 마이크 허용도 같이 물어봐요)
    if (!asked.current && !IOS && navigator.mediaDevices?.getUserMedia) {
      // 마이크 허용 창을 먼저 띄운다 (말 인식만 켜면 크롬이 조용히 막는 경우가 있음)
      try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }); st.getTracks().forEach((t) => t.stop()); }
      catch (err) { setMicErr((err as DOMException)?.name || 'not-allowed'); setTyping(true); return; }
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
                    {showSide && ko(l.ko) && (hideKo && !peek.includes(i)
                      ? <button className="see-ko" aria-label={tt('뜻 보기')} onClick={() => setPeek((p) => [...p, i])}>{ko(l.ko)}</button>
                      : <small className="ko">{ko(l.ko)}</small>)}
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
                    <button onClick={() => (l.audio ? playSrc(l.audio) : speak(l.en, 'en'))}><PlayI />{tt('다시 듣기')}</button>
                    <button onClick={() => (l.audio ? playSrc(l.audio, 0.7) : speak(l.en, 'en', { rate: 0.7 }))}>{tt('천천히')}</button>
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
                    : <small className={`res${l.how === 'picked' ? ' pk' : ''}`}>{l.how === 'picked' ? tt('골라서 보냄') : tt('잘 통했어요')}</small>}
                  <small className="tm">{hm(l.at)}</small>
                </div>
                <div className="bub"><p lang="en">{l.en}</p></div>
              </div>
              {/* 통화 중에는 고치지 않아요. 다듬을 문장은 통화 뒤에 모아서 보여 줘요 */}
            </div>
          );
        })}
        {phase === 'me' && heard && <div className="cl-me live"><div className="line"><div className="bub"><p lang="en">{heard}</p></div></div></div>}
        {myTurn && !help && !practice && (
          <div className="cl-me"><button className="cl-ask" onClick={() => setHelp(true)}><Icon name="bulb" />{tt('뭐라고 하지?')}</button></div>
        )}
        {myTurn && help && !practice && (
          <div className="cl-picks">
            {turn.replies.map((r) => <button key={r.en} onClick={() => { setPractice(r); setHelp(false); }}><b lang="en">{r.en}</b><small>{ko(r.ko)}</small></button>)}
          </div>
        )}
        {myTurn && practice && (
          <div className="cl-prac">
            <small>{tt('이렇게 말해 보세요')}</small>
            <b lang="en">{practice.en}</b>
            <p>{ko(practice.ko)}</p>
            <div className="pacts">
              <button onClick={() => speak(practice.en, 'en')}><PlayI />{tt('듣기')}</button>
              <button onClick={() => speak(practice.en, 'en', { rate: 0.7 })}>{tt('천천히')}</button>
            </div>
            <button className="skip" onClick={() => answer(practice.en, 'picked')}>{tt('그냥 보내기 (연습 안 함)')}</button>
          </div>
        )}
        {phase === 'me' && micErr && (
          <div className="cl-warn"><span><b>{micMsg(micErr)[0]}</b><small>{micMsg(micErr)[1]}</small></span>{micErr !== 'no-recognition' && <button onClick={retryMic}>{tt('다시 시도')}</button>}</div>
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

/** 다듬은 문장을 배울래요에 담을 수 있게 카드 모양으로 */
// 통화 대본의 뜻은 아직 한국어만 있어요. 다른 화면 언어에서는 한국어 뜻을 숨겨요
const ko = (s?: string) => (uiLang() === 'ko' ? s : '');
const asCard = (en: string, ko: string): Card => ({ id: `call-${en}`, lang: 'en', cat: '일상', words: en.split(' '), key: [], expr: '', tr: { ko }, mean: {} });

function Summary({ scene, lines, secs, onClose, onAgain }: { scene: Scene; lines: Line[]; secs: number; onClose: () => void; onAgain: () => void }) {
  const [view, setView] = useState(false);
  const { speak } = useUi();
  const { findSaved, toggleSave } = useActions();
  const mine = lines.filter((l) => l.who === 'me');
  const self = mine.filter((l) => l.how !== 'picked').length;
  const fix = mine.filter((l) => !l.good && l.how !== 'picked').map((l) => ({ said: l.en, better: scene.turns[l.turn].replies[0] }));
  // 오늘의 한 줄: 다듬을 문장이 있으면 그 고친 문장, 없으면 이번 통화의 대표 대답 하나
  const best = fix[0]?.better ?? scene.turns[mine[0]?.turn ?? 0]?.replies[0];
  const early = mine.length < scene.turns.length; // 대본 끝까지 가기 전에 끊음
  const time = secs >= 60 ? tt('{m}분 {s}초', { m: Math.floor(secs / 60), s: secs % 60 }) : tt('{s}초', { s: secs });
  if (view) return <Replay scene={scene} lines={lines} onBack={() => setView(false)} onAgain={onAgain} />;
  const save = (en: string, k: string) => { const card = asCard(en, k); return { on: !!findSaved('s', card), go: () => toggleSave('s', card) }; };
  return (
    <section className="screen call-sum">
      <div className="cs-top"><button className="x" aria-label={tt('닫기')} onClick={onClose}><Icon name="close" /></button><b>{tt('통화 결과')}</b><span /></div>
      <div className="cs-body">
        <span className="cs-av">{scene.who[0]}</span>
        <h2>{early ? tt('{t} 만에 끊었어요', { t: time }) : tt('잘 통했어요!')}</h2>
        <p className="cs-meta">{early ? tt('괜찮아요, 다음에 이어서 해요') : `${scene.who} · ${time} · ${tt(scene.title)}`}</p>
        {best && (() => { const sv = save(best.en, best.ko); return (
          <div className="cs-card cs-one">
            <div className="hd"><b>{tt('오늘의 한 줄')}</b><button className="cs-play" aria-label={tt('듣기')} onClick={() => speak(best.en, 'en')}><PlayI /></button></div>
            <p className="one" lang="en">{best.en}</p>
            {ko(best.ko) && <small className="note">{ko(best.ko)}</small>}
            <button className={`cs-save${sv.on ? ' on' : ''}`} onClick={sv.go}>{sv.on ? tt('배울래요에 담았어요') : tt('+ 배울래요에 담기')}</button>
          </div>
        ); })()}
        <div className="cs-stats">
          <div><b>{self}</b><small>{tt('직접 말함')}</small></div>
          <div><b>{mine.length - self}</b><small>{tt('골라서 보냄')}</small></div>
          <div><b>{fix.length}</b><small>{tt('다듬기')}</small></div>
        </div>
        {/* 다듬기는 글 먼저: 내가 한 말 → 이렇게 말해 보세요 → 듣기 */}
        {fix.map((f, i) => { const sv = save(f.better.en, f.better.ko); return (
          <div key={i} className="cs-card cs-fix">
            <div className="hd"><b>{tt('다듬어 볼 문장')}</b><small>{i + 1} / {fix.length}</small></div>
            <small className="lb">{tt('내가 한 말')}</small>
            <p className="said" lang="en">{f.said}</p>
            <small className="lb blue">{tt('이렇게 말해 보세요')}</small>
            <p className="better" lang="en">{f.better.en}</p>
            {ko(f.better.ko) && <small className="note">{ko(f.better.ko)}</small>}
            <div className="cs-acts">
              <button onClick={() => speak(f.better.en, 'en')}><PlayI />{tt('들어 보기')}</button>
              <button onClick={() => speak(f.better.en, 'en', { rate: 0.8 })}>0.8×</button>
              <button className={`cs-save${sv.on ? ' on' : ''}`} onClick={sv.go}>{sv.on ? tt('담았어요') : tt('+ 배울래요')}</button>
            </div>
          </div>
        ); })}
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
              <div className="bub"><p lang="en"><Marked text={l.en} /></p><small className="ko">{ko(l.ko)}</small></div>
              <button className="cs-play" aria-label={tt('다시 듣기')} onClick={() => (l.audio ? playSrc(l.audio) : speak(l.en, 'en'))}><svg viewBox="0 0 10 10"><path d="M1 0l8.5 5L1 10z" /></svg></button>
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
