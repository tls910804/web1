import { useEffect, useRef, useState } from 'react';
import { tt } from '../i18n';
import { Icon } from '../components/Icon';
import { CARDS } from '../data';
import { stopAudio } from '../lib/audio';
import { speechOk } from '../lib/speech';
import { sentence, trOf } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';

// 쉼: 파스텔 배경 위로 문장을 아주 천천히 들려주다가 타이머가 끝나면 멈춘다
type SceneId = 'dusk' | 'rain' | 'sea' | 'snow';
const SCENES: { id: SceneId; name: string; sky: string[] }[] = [
  { id: 'dusk', name: '노을 구름', sky: ['#f9d5c8', '#ecd0e6', '#cfd8f3'] },
  { id: 'rain', name: '비 오는 창', sky: ['#cddff1', '#dcd9f0', '#efe0ea'] },
  { id: 'sea', name: '달빛 바다', sky: ['#bcc6ec', '#ddd2ef', '#f6dbe0'] },
  { id: 'snow', name: '조용한 눈', sky: ['#d5eee6', '#e6e8f2', '#f5e3ec'] },
];
const SCENE_KEY = 'rest-scene';

/** 잔잔하게 움직이는 파스텔 배경 (움직임 줄이기 설정이면 멈춘 그림) */
export function RestScene({ id }: { id: SceneId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const sc = SCENES.find((s) => s.id === id)!;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0;
    const size = () => { const d = Math.min(2, devicePixelRatio || 1); w = cv.clientWidth; h = cv.clientHeight; cv.width = w * d; cv.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    size();
    const R = (a: number, b: number) => a + Math.random() * (b - a);
    // 장면마다 떠다니는 것들
    const many = id === 'snow' ? 70 : id === 'rain' ? 60 : id === 'sea' ? 40 : 7;
    const ps = Array.from({ length: many }, () => ({ x: R(0, 1), y: R(0, 1), r: R(0.6, 1), v: R(0.4, 1), p: R(0, 6.28) }));
    const bokeh = Array.from({ length: id === 'rain' ? 9 : 0 }, (_, i) => ({ x: R(0, 1), y: R(0.1, 0.9), r: R(18, 46), c: ['#ffd6e0', '#fff1c9', '#d9e6ff'][i % 3], v: R(0.2, 0.5) }));
    const draw = (t: number) => {
      const s = t / 1000;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      sc.sky.forEach((c, i) => g.addColorStop(i / (sc.sky.length - 1), c));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.save();
      if (id === 'dusk') {
        // 크고 부드러운 구름이 아주 천천히 흐른다
        for (const p of ps) {
          const x = ((p.x * (w + 400) + s * 6 * p.v) % (w + 400)) - 200, y = p.y * h * 0.8;
          const rg = ctx.createRadialGradient(x, y, 0, x, y, 160 * p.r);
          rg.addColorStop(0, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(x, y, 190 * p.r, 90 * p.r, 0, 0, 7); ctx.fill();
        }
        const sun = ctx.createRadialGradient(w * 0.5, h * 0.72, 0, w * 0.5, h * 0.72, w * 0.5);
        sun.addColorStop(0, 'rgba(255,214,170,.55)'); sun.addColorStop(1, 'rgba(255,214,170,0)');
        ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
      }
      if (id === 'rain') {
        for (const b of bokeh) {
          const y = ((b.y * h - s * 4 * b.v) % h + h) % h;
          const rg = ctx.createRadialGradient(b.x * w, y, 0, b.x * w, y, b.r);
          rg.addColorStop(0, b.c + 'cc'); rg.addColorStop(1, b.c + '00');
          ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(b.x * w, y, b.r, 0, 7); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.lineCap = 'round';
        for (const p of ps) {
          const y = ((p.y * h + s * 70 * p.v) % (h + 40)) - 20, x = p.x * w;
          ctx.globalAlpha = 0.25 + p.r * 0.35; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 14 * p.r); ctx.stroke();
        }
      }
      if (id === 'sea') {
        const hz = h * 0.62;
        for (const p of ps) { if (p.y > 0.55) continue; ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(s * 0.6 + p.p)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x * w, p.y * hz, 1.1 * p.r, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
        const moon = ctx.createRadialGradient(w * 0.7, h * 0.2, 0, w * 0.7, h * 0.2, 90);
        moon.addColorStop(0, 'rgba(255,250,235,1)'); moon.addColorStop(0.3, 'rgba(255,250,235,.95)'); moon.addColorStop(0.32, 'rgba(255,250,235,.25)'); moon.addColorStop(1, 'rgba(255,250,235,0)');
        ctx.fillStyle = moon; ctx.beginPath(); ctx.arc(w * 0.7, h * 0.2, 90, 0, 7); ctx.fill();
        const sea = ctx.createLinearGradient(0, hz, 0, h); sea.addColorStop(0, 'rgba(170,180,230,.75)'); sea.addColorStop(1, 'rgba(205,190,230,.9)');
        ctx.fillStyle = sea; ctx.fillRect(0, hz, w, h - hz);
        ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.2;
        for (let i = 0; i < 7; i++) {
          const y = hz + 18 + i * 26, amp = 3 + i;
          ctx.globalAlpha = 0.55 - i * 0.06; ctx.beginPath();
          for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y + Math.sin(x / 40 + s * 0.5 + i) * amp);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.35; ctx.fillStyle = '#fffaf0';
        for (let i = 0; i < 6; i++) ctx.fillRect(w * 0.7 - 30 + Math.sin(s + i) * 6, hz + 10 + i * 22, 60 - i * 7, 2);
      }
      if (id === 'snow') {
        ctx.fillStyle = '#fff';
        for (const p of ps) {
          const y = ((p.y * h + s * 14 * p.v) % (h + 20)) - 10, x = p.x * w + Math.sin(s * 0.5 + p.p) * 12;
          ctx.globalAlpha = 0.5 + p.r * 0.45; ctx.beginPath(); ctx.arc(x, y, 1.4 + p.r * 2.2, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        const hill = ctx.createLinearGradient(0, h * 0.78, 0, h); hill.addColorStop(0, '#ffffffcc'); hill.addColorStop(1, '#ffffff');
        ctx.fillStyle = hill; ctx.beginPath(); ctx.moveTo(0, h * 0.82);
        ctx.quadraticCurveTo(w * 0.35, h * 0.74, w * 0.6, h * 0.8); ctx.quadraticCurveTo(w * 0.85, h * 0.85, w, h * 0.78); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
      }
      ctx.restore();
      if (!still) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(size); ro.observe(cv);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [id]);
  return <canvas className="rest-cv" ref={ref} aria-hidden />;
}

const est = (s: string, rate: number) => Math.max(1800, s.length * 85) / rate;

export function Rest() {
  const { state } = useStore();
  const { speak } = useUi();
  const [scene, setScene0] = useState<SceneId>(() => { try { return (localStorage.getItem(SCENE_KEY) as SceneId) || 'dusk'; } catch { return 'dusk'; } });
  const setScene = (s: SceneId) => { setScene0(s); try { localStorage.setItem(SCENE_KEY, s); } catch { /* 이번만 적용 */ } };
  const [mins, setMins] = useState(30);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dim, setDim] = useState(false);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<'en' | 'ko' | 'rest'>('en');
  const [left, setLeft] = useState(0);
  const [doneMsg, setDoneMsg] = useState('');

  // 들을 문장: 배울래요 문장, 없으면 배우는 언어의 앱 문장
  const saved = state.saved.filter((x) => x.kind === 's').map((x) => x.card);
  const list = saved.length ? saved : CARDS.filter((c) => state.learn.includes(c.lang)).slice(0, 20);
  const from = saved.length ? tt('배울래요 문장') : tt('추천 문장');
  const card = list[i % Math.max(1, list.length)];
  const minsFor = Math.max(1, Math.round(list.reduce((a, c) => a + est(sentence(c), 0.7) * 2 + 4000, 0) / 60000));

  const hush = () => { stopAudio(); if (speechOk()) speechSynthesis.cancel(); };
  useEffect(() => () => hush(), []);

  // 영어 두 번(아주 천천히) → 뜻 한 번 → 쉼 → 다음
  useEffect(() => {
    if (!playing || paused || !card) return;
    const en = sentence(card), ko = trOf(card.tr, state.native);
    let t: number;
    if (phase === 'en') { speak(en, card.lang, { rate: 0.7, repeat: 2, quiet: true }); t = window.setTimeout(() => setPhase(ko ? 'ko' : 'rest'), est(en, 0.7) * 2 + 900); }
    else if (phase === 'ko') { speak(ko, state.native, { rate: 0.9, quiet: true }); t = window.setTimeout(() => setPhase('rest'), est(ko, 0.9) + 600); }
    else t = window.setTimeout(() => { setI((n) => n + 1); setPhase('en'); }, 3200);
    return () => clearTimeout(t);
  }, [playing, paused, phase, i, card]); // eslint-disable-line react-hooks/exhaustive-deps

  // 타이머: 다 되면 멈추고 처음 화면으로
  useEffect(() => {
    if (!playing || paused) return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [playing, paused]);
  useEffect(() => { if (playing && left <= 0) { stop(); setDoneMsg(tt('{n}문장을 들었어요. 잘 자요', { n: i })); } }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => { if (!list.length) return; setI(0); setPhase('en'); setLeft(mins * 60); setPaused(false); setDim(false); setDoneMsg(''); setPlaying(true); };
  const stop = () => { hush(); setPlaying(false); setPaused(false); setDim(false); };
  const step = (d: number) => { hush(); setI((n) => Math.max(0, n + d)); setPhase('en'); };
  const mmss = `${String(Math.floor(Math.max(0, left) / 60)).padStart(2, '0')}:${String(Math.max(0, left) % 60).padStart(2, '0')}`;

  if (playing && card) {
    return (
      <section className="screen rest playing" onClick={() => dim && setDim(false)}>
        <RestScene id={scene} />
        <div className="rest-top"><span><i />{tt('{t} 남음', { t: mmss })}</span><span>{(i % list.length) + 1} / {list.length}</span></div>
        <div className="rest-mid" key={i}>
          <p className="en" lang={card.lang}>{sentence(card)}</p>
          <p className={`ko${phase === 'en' ? ' wait' : ''}`}>{trOf(card.tr, state.native)}</p>
        </div>
        <div className="rest-ctl">
          <button aria-label={tt('이전 문장')} onClick={() => step(-1)}><svg viewBox="0 0 24 24"><path d="M17 6l-8 6 8 6zM7 6v12" /></svg></button>
          <button className="big" aria-label={paused ? tt('다시 듣기') : tt('잠깐 멈춤')} onClick={() => { if (!paused) hush(); setPaused(!paused); }}>
            {paused ? <svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" /></svg> : <svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14" /></svg>}
          </button>
          <button aria-label={tt('다음 문장')} onClick={() => step(1)}><svg viewBox="0 0 24 24"><path d="M7 6l8 6-8 6zM17 6v12" /></svg></button>
        </div>
        <div className="rest-bot">
          <button onClick={(e) => { e.stopPropagation(); setDim(true); }}><Icon name="moon" />{tt('화면 어둡게')}</button>
          <button onClick={stop}>{tt('그만 듣기')}</button>
        </div>
        {dim && <div className="rest-dim">{tt('눌러서 다시 밝게')}</div>}
      </section>
    );
  }

  return (
    <section className="screen rest">
      <RestScene id={scene} />
      <div className="rest-home">
        <h2>{tt('쉼')}</h2>
        <p className="sub">{doneMsg || tt('담은 문장을 잔잔하게 들으며 쉬어요')}</p>
        <div className="rest-scenes">
          {SCENES.map((s) => (
            <button key={s.id} className={s.id === scene ? 'on' : ''} onClick={() => setScene(s.id)}>
              <i style={{ background: `linear-gradient(${s.sky.join(',')})` }} />{tt(s.name)}
            </button>
          ))}
        </div>
        <div className="rest-card">
          <div className="t"><b>{tt('{f} {n}개', { f: from, n: list.length })}</b><small>{tt('아주 천천히 · 두 번씩 · 뜻도 읽어 줘요 · 한 바퀴 약 {m}분', { m: minsFor })}</small></div>
          <div className="mins">{[15, 30, 60].map((m) => <button key={m} className={m === mins ? 'on' : ''} onClick={() => setMins(m)}>{m === 60 ? tt('1시간') : tt('{n}분', { n: m })}</button>)}</div>
        </div>
        <button className="rest-play" onClick={start} disabled={!list.length}><svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" /></svg></button>
        <small className="rest-hint">{list.length ? tt('틀어 두기 · {n}분 뒤 저절로 멈춰요', { n: mins }) : tt('배울 언어를 먼저 골라 주세요')}</small>
      </div>
    </section>
  );
}

