// 미리 만들어 둔 음성 파일(public/audio)을 재생한다. 파일이 없는 문장(직접 추가한 문장 등)은 false를 돌려줘서
// 호출한 쪽이 브라우저 기본 음성으로 읽게 한다.
import { CONTENT_BASE } from './content';

interface Entry { f: string; s?: number }

let manifest: Record<string, Entry> | null = null;
const base = `${CONTENT_BASE}audio/`;

fetch(`${base}manifest.json`)
  .then((r) => (r.ok ? r.json() : null))
  .then((m) => { manifest = m; })
  .catch(() => { manifest = null; });

// 아이폰(사파리)은 사용자가 누른 순간에 한 번 재생한 audio 요소만 나중에 스스로 재생할 수 있어요.
// 그래서 재생기를 하나만 두고, 첫 터치 때 아주 짧은 무음을 틀어 잠금을 풀어 둬요 (자동재생용).
const player = new Audio();
function silentWav() {
  const n = 240, b = new DataView(new ArrayBuffer(44 + n * 2)); // 24kHz 10ms 무음
  const s = (o: number, t: string) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  s(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); s(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true);
  b.setUint16(22, 1, true); b.setUint32(24, 24000, true); b.setUint32(28, 48000, true); b.setUint16(32, 2, true);
  b.setUint16(34, 16, true); s(36, 'data'); b.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([b.buffer], { type: 'audio/wav' }));
}
let unlocked = false;
const unlock = () => {
  if (unlocked) return;
  unlocked = true;
  if (!player.src) { player.src = silentWav(); player.play().catch(() => { unlocked = false; }); }
};
if (typeof document !== 'undefined') ['touchend', 'click'].forEach((t) => document.addEventListener(t, unlock, { capture: true }));

let current: HTMLAudioElement | null = null;
let token = 0;

const warm = new Set<string>();
/** 다음 카드의 음성을 미리 받아 둔다 */
export function preloadAudio(text: string, lang: string) {
  const e = manifest?.[`${lang}|${text}`];
  if (!e || warm.has(e.f)) return;
  warm.add(e.f);
  const a = new Audio(`${base}${e.f}.m4a`);
  a.preload = 'auto';
}

export function stopAudio() {
  token++;
  if (current) { current.pause(); current = null; }
}

export function playAudio(text: string, lang: string, slow: boolean, repeat = 1): boolean {
  const e = manifest?.[`${lang}|${text}`];
  if (!e) return false;
  stopAudio();
  const my = token;
  const url = `${base}${e.f}${slow && e.s ? '.slow' : ''}.m4a`;
  let left = repeat;
  const play = () => {
    const a = player;
    a.src = url;
    // 느린 파일이 따로 없으면 보통 파일을 느리게(음높이는 그대로). 사파리는 src를 바꾸면 속도를 default로 되돌려요
    a.defaultPlaybackRate = a.playbackRate = slow && !e.s ? 0.75 : 1;
    current = a;
    a.onended = () => { if (token === my && --left > 0) setTimeout(play, 350); };
    a.play().catch(() => { /* 자동 재생이 막힌 경우는 조용히 넘어간다 */ });
  };
  play();
  return true;
}
