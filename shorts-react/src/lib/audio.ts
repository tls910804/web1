// 미리 만들어 둔 음성 파일(public/audio)을 재생한다. 파일이 없는 문장(직접 추가한 문장 등)은 false를 돌려줘서
// 호출한 쪽이 브라우저 기본 음성으로 읽게 한다.
interface Entry { f: string; s?: number }

let manifest: Record<string, Entry> | null = null;
const base = `${import.meta.env.BASE_URL}audio/`;

fetch(`${base}manifest.json`)
  .then((r) => (r.ok ? r.json() : null))
  .then((m) => { manifest = m; })
  .catch(() => { manifest = null; });

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
    const a = new Audio(url);
    current = a;
    a.onended = () => { if (token === my && --left > 0) setTimeout(play, 350); };
    a.play().catch(() => { /* 자동 재생이 막힌 경우는 조용히 넘어간다 */ });
  };
  play();
  return true;
}
