import { useEffect, useRef, useState } from 'react';
import { tt } from '../i18n';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { stopAudio } from '../lib/audio';
import { speechOk } from '../lib/speech';
import { useUi } from '../ui';

// shortcut: 진짜 AI가 아니라 정해 둔 대본으로 통화한다. AI 대화를 붙이려면 서버와 언어 모델 API가 필요하다
type Turn = { ai: string; ko: string; replies: { en: string; ko: string }[] };
type Scene = { id: string; title: string; who: string; sub: string; turns: Turn[] };

const SCENES: Scene[] = [
  {
    id: 'late', title: '친구에게 늦는다고 말하기', who: 'Emma', sub: '친구 · 약속 10분 전',
    turns: [
      { ai: "Hey! Are you almost here? I'm already at the cafe.", ko: '야! 거의 다 왔어? 나 벌써 카페야.', replies: [{ en: "Sorry, I'm running late.", ko: '미안, 좀 늦어.' }, { en: "I'm on my way!", ko: '가는 중이야!' }] },
      { ai: 'Oh no, how long do you think you will be?', ko: '저런, 얼마나 걸릴 것 같아?', replies: [{ en: "I'll be there in ten minutes.", ko: '10분 안에 갈게.' }, { en: 'Maybe fifteen minutes.', ko: '15분쯤?' }] },
      { ai: 'No worries. Do you want me to order something for you?', ko: '괜찮아. 뭐 먼저 시켜 줄까?', replies: [{ en: 'An iced americano, please.', ko: '아이스 아메리카노 부탁해.' }, { en: "I'm good, thanks.", ko: '괜찮아, 고마워.' }] },
      { ai: 'Got it. See you soon!', ko: '알겠어. 이따 봐!', replies: [{ en: 'See you soon!', ko: '이따 봐!' }, { en: 'Thanks, see you!', ko: '고마워, 이따 봐!' }] },
    ],
  },
  {
    id: 'cafe', title: '카페에서 주문하기', who: 'Barista', sub: '카페 · 주문 받는 중',
    turns: [
      { ai: 'Hi there! What can I get for you today?', ko: '안녕하세요! 오늘 뭐 드릴까요?', replies: [{ en: 'Can I get an iced latte?', ko: '아이스 라떼 주시겠어요?' }, { en: "I'd like a hot americano.", ko: '따뜻한 아메리카노 주세요.' }] },
      { ai: 'Sure. For here or to go?', ko: '네. 드시고 가세요, 가져가세요?', replies: [{ en: 'To go, please.', ko: '가져갈게요.' }, { en: 'For here, please.', ko: '먹고 갈게요.' }] },
      { ai: 'Anything else?', ko: '더 필요한 거 있으세요?', replies: [{ en: "That's all, thanks.", ko: '그게 다예요, 감사합니다.' }, { en: 'Can I get a cookie too?', ko: '쿠키도 하나 주세요.' }] },
      { ai: "Great, it'll be ready in a minute.", ko: '좋아요, 금방 나와요.', replies: [{ en: 'Thank you!', ko: '감사합니다!' }, { en: 'Great, thanks.', ko: '좋아요, 고마워요.' }] },
    ],
  },
  {
    id: 'work', title: '회의 일정 잡기', who: 'Alex', sub: '회사 동료 · 업무 통화',
    turns: [
      { ai: 'Hi, do you have a minute to talk about the project?', ko: '안녕하세요, 프로젝트 얘기 잠깐 할 수 있어요?', replies: [{ en: 'Sure, what is it?', ko: '그럼요, 무슨 일이에요?' }, { en: "Yes, I'm free now.", ko: '네, 지금 괜찮아요.' }] },
      { ai: 'Can we set up a meeting this week?', ko: '이번 주에 회의 잡을 수 있을까요?', replies: [{ en: 'How about Thursday?', ko: '목요일 어때요?' }, { en: 'Let me check my schedule.', ko: '일정 확인해 볼게요.' }] },
      { ai: 'Thursday at 3 works for me.', ko: '목요일 3시 좋아요.', replies: [{ en: "Perfect, I'll send an invite.", ko: '좋아요, 초대 보낼게요.' }, { en: 'Sounds good.', ko: '좋습니다.' }] },
      { ai: "Great. Let's call it a day then. Talk soon!", ko: '좋아요. 그럼 오늘은 여기까지 해요. 또 얘기해요!', replies: [{ en: 'Talk soon!', ko: '또 얘기해요!' }, { en: 'Thanks, bye!', ko: '고마워요, 안녕히!' }] },
    ],
  },
];

type Rec = { new (): SpeechRec };
interface SpeechRec { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null; start(): void; stop(): void }
const Recognition = (window as unknown as { SpeechRecognition?: Rec; webkitSpeechRecognition?: Rec }).SpeechRecognition
  || (window as unknown as { webkitSpeechRecognition?: Rec }).webkitSpeechRecognition;

const words = (s: string) => s.toLowerCase().replace(/[^a-z' ]/g, '').split(' ').filter(Boolean);
/** 추천 답변과 겹치는 단어 비율 */
const closeness = (said: string, ref: string) => {
  const a = new Set(words(said)), b = words(ref);
  return b.length ? b.filter((w) => a.has(w)).length / b.length : 0;
};
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

type Line = { who: 'ai' | 'me'; en: string; ko?: string; good?: boolean };

export function Call() {
  const [scene, setScene] = useState<Scene | null>(null);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [secs, setSecs] = useState(0);
  if (scene && lines) return <Summary scene={scene} lines={lines} secs={secs} onClose={() => { setScene(null); setLines(null); }} />;
  if (scene) return <Live scene={scene} onEnd={(l, s) => { setLines(l); setSecs(s); }} />;
  return (
    <section className="screen call-home">
      <div className="ch-body">
        <h1>{tt('AI 전화')}</h1>
        <p className="ch-sub">{tt('전화처럼 영어로 대화해요. 들리는 대로 소리 내어 대답하면 돼요.')}</p>
        <button className="ch-now" onClick={() => setScene(SCENES[Math.floor(Math.random() * SCENES.length)])}>
          <span className="ic"><Icon name="phone" /></span>
          <span><b>{tt('바로 전화하기')}</b><small>{tt('상황은 랜덤으로 · 약 2분')}</small></span>
        </button>
        <b className="ch-lbl">{tt('상황 골라서 전화하기')}</b>
        <div className="ch-list">
          {SCENES.map((s) => (
            <button key={s.id} className="ch-item" onClick={() => setScene(s)}>
              <span className="av">{s.who[0]}</span>
              <span className="tx"><b>{tt(s.title)}</b><small>{s.who} · {tt(s.sub)}</small></span>
              <Icon name="phone" />
            </button>
          ))}
        </div>
        <div className="ch-tip">{tt('매일 정한 시간에 AI가 먼저 전화를 거는 기능은 준비 중이에요.')}</div>
      </div>
    </section>
  );
}

function Live({ scene, onEnd }: { scene: Scene; onEnd: (lines: Line[], secs: number) => void }) {
  const { speak } = useUi();
  const [k, setK] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [secs, setSecs] = useState(0);
  const [phase, setPhase] = useState<'ring' | 'ai' | 'me'>('ring');
  const [heard, setHeard] = useState('');
  const [listening, setListening] = useState(false);
  const [showKo, setShowKo] = useState(false);
  const [hint, setHint] = useState(false);
  const [micErr, setMicErr] = useState('');
  const rec = useRef<SpeechRec | null>(null);
  const turn = scene.turns[k];

  useEffect(() => { const t = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => () => { rec.current?.stop(); stopAudio(); if (speechOk()) speechSynthesis.cancel(); }, []);
  // 신호음 뒤 AI가 먼저 말한다
  useEffect(() => { if (phase !== 'ring') return; const t = setTimeout(() => setPhase('ai'), 1600); return () => clearTimeout(t); }, [phase]);
  useEffect(() => {
    if (phase !== 'ai' || !turn) return;
    setLines((l) => [...l, { who: 'ai', en: turn.ai, ko: turn.ko }]);
    speak(turn.ai, 'en', { quiet: true });
    const t = setTimeout(() => { setPhase('me'); setHint(false); setHeard(''); }, Math.max(1800, turn.ai.length * 70));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, k]);

  const answer = (said: string) => {
    rec.current?.stop();
    setListening(false);
    const good = turn.replies.some((r) => closeness(said, r.en) >= 0.5);
    setLines((l) => [...l, { who: 'me', en: said, good }]);
    if (k + 1 < scene.turns.length) { setK(k + 1); setPhase('ai'); } else setTimeout(() => onEnd([...lines, { who: 'me', en: said, good }], secs), 600);
  };
  const listen = () => {
    if (!Recognition) return;
    const r = new Recognition();
    r.lang = 'en-US';
    r.interimResults = true;
    let last = '';
    r.onresult = (e) => {
      last = Array.from(e.results).map((x) => x[0].transcript).join(' ');
      setHeard(last);
      const fin = e.results[e.results.length - 1];
      if (fin.isFinal) answer(last);
    };
    r.onend = () => setListening(false);
    r.onerror = (e) => {
      setListening(false);
      // 마이크를 막았거나 이 브라우저가 말하기 인식을 못 쓰면, 안내하고 추천 답변으로 대답하게 한다
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') { setMicErr(e.error); setHint(true); }
    };
    rec.current = r;
    setHeard('');
    setListening(true);
    r.start();
  };

  const recent = lines.slice(-3);
  return (
    <section className="screen call-live">
      <div className="cl-top">
        <span className="av">{scene.who[0]}</span>
        <b>{scene.who}</b>
        <small>{phase === 'ring' ? tt('연결하는 중…') : mmss(secs)}</small>
      </div>

      <div className="cl-talk">
        {recent.map((l, i) => (
          <div key={lines.length - recent.length + i} className={`cl-line ${l.who}${l.good ? ' good' : ''}`}>
            <p lang="en">{l.en}</p>
            {l.who === 'ai' && showKo && <small>{l.ko}</small>}
            {l.who === 'me' && l.good && <small>{tt('잘 말했어요')}</small>}
          </div>
        ))}
        {phase === 'me' && heard && <div className="cl-line me live"><p lang="en">{heard}</p></div>}
      </div>

      {phase === 'me' && (
        <div className="cl-me">
          {hint
            ? <div className="cl-hints">{turn.replies.map((r) => <button key={r.en} onClick={() => answer(r.en)}><b lang="en">{r.en}</b><small>{r.ko}</small></button>)}</div>
            : <button className="cl-hint" onClick={() => setHint(true)}><Icon name="bulb" />{tt('뭐라고 할지 모르겠어요')}</button>}
          {micErr && <p className="cl-nomic">{tt('이 브라우저에서는 마이크를 쓸 수 없어요. 사파리나 크롬에서 열거나, 위 답변을 눌러 대답해요.')}</p>}
          {Recognition && !micErr
            ? <button className={`cl-mic${listening ? ' on' : ''}`} onClick={listening ? () => rec.current?.stop() : listen}><Icon name="mic" /></button>
            : !micErr && <p className="cl-nomic">{tt('이 브라우저는 말하기 인식을 지원하지 않아요. 위 답변을 눌러 대답해요.')}</p>}
          <small className="cl-say">{listening ? tt('듣고 있어요… 말이 끝나면 저절로 넘어가요') : Recognition && !micErr ? tt('마이크를 누르고 영어로 대답해 보세요') : ''}</small>
        </div>
      )}

      <div className="cl-ctl">
        <button className={showKo ? 'on' : ''} onClick={() => setShowKo(!showKo)}><span>가</span>{tt('뜻 보기')}</button>
        <button onClick={() => speak(turn?.ai ?? '', 'en', { rate: 0.7 })} disabled={phase === 'ring'}><Icon name="clock" />{tt('천천히')}</button>
        <button className="end" onClick={() => onEnd(lines, secs)}><Icon name="phone" />{tt('끊기')}</button>
      </div>
    </section>
  );
}

function Summary({ scene, lines, secs, onClose }: { scene: Scene; lines: Line[]; secs: number; onClose: () => void }) {
  const mine = lines.filter((l) => l.who === 'me');
  const good = mine.filter((l) => l.good).length;
  return (
    <section className="screen call-sum">
      <div className="cs-body">
        <span className="av big">{scene.who[0]}</span>
        <h2>{tt('통화 끝!')}</h2>
        <p className="cs-meta">{tt(scene.title)} · {mmss(secs)} · {tt('내가 한 말 {n}번', { n: mine.length })}</p>
        <div className="cs-score"><b>{good}</b> / {scene.turns.length}<small>{tt('자연스럽게 대답했어요')}</small></div>
        <b className="ch-lbl">{tt('대화 다시 보기')}</b>
        <div className="cs-list">
          {lines.map((l, i) => {
            const t = l.who === 'me' ? scene.turns[lines.slice(0, i).filter((x) => x.who === 'me').length] : null;
            return (
              <div key={i} className={`cs-row ${l.who}`}>
                <small>{l.who === 'ai' ? scene.who : tt('나')}</small>
                <p lang="en">{l.en}</p>
                {l.ko && <small className="ko">{l.ko}</small>}
                {l.who === 'me' && !l.good && t && <small className="tip">{tt('이렇게도 말할 수 있어요')}: <b lang="en">{t.replies[0].en}</b></small>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="foot"><Button kind="dark" style={{ minHeight: 52 }} onClick={onClose}>{tt('확인')}</Button></div>
    </section>
  );
}
