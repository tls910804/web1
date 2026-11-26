// AI 전화 서버(ai-call-worker)에 사용자 말에 대한 AI의 다음 대사와 그 목소리(Chirp 3 HD)를 받아요.
// 서버 주소가 없거나, 한도를 넘었거나, 실패하면 null → 앱은 대본으로 그냥 이어가요.
const API = import.meta.env.VITE_CALL_API as string | undefined;
export const aiOn = !!API;

const DEV_KEY = 'call-device';
const device = () => {
  try {
    let id = localStorage.getItem(DEV_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEV_KEY, id); }
    return id;
  } catch { return 'anon'; }
};

type Scene = { title: string; who: string; role: string; level: string; mission: string[] };
export async function aiReact(scene: Scene, next: string, said: string, history: { who: 'ai' | 'me'; en: string }[]): Promise<{ en: string; ko: string; audio: string } | null> {
  if (!API) return null;
  try {
    const r = await fetch(`${API.replace(/\/$/, '')}/react`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        device: device(),
        scene: { title: scene.title, who: scene.who, role: scene.role, level: scene.level, mission: scene.mission },
        next,
        said: said.slice(0, 200),
        history: history.slice(-6).map((l) => ({ who: l.who, en: l.en.slice(0, 300) })),
      }),
      signal: AbortSignal.timeout(10000), // 너무 오래 걸리면 기다리지 않고 대본으로
    });
    if (!r.ok) return null;
    const d = await r.json();
    return typeof d?.en === 'string' && d.en && typeof d.audio === 'string' && d.audio ? { en: d.en, ko: typeof d.ko === 'string' ? d.ko : '', audio: `data:audio/mpeg;base64,${d.audio}` } : null;
  } catch { return null; }
}
