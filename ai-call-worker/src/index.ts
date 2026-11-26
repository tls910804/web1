import { POLICY, dayKey, invalid, overLimit, systemPrompt, type ReactBody } from './policy';

export interface Env {
  GOOGLE_TTS_KEY: string; // wrangler secret put GOOGLE_TTS_KEY (Text-to-Speech API만 쓰게 제한한 키)
  GEMINI_KEY: string; // wrangler secret put GEMINI_KEY (Gemini는 따로 만든 키여야 해요)
  LIMITS: KVNamespace;
  ALLOWED_ORIGINS: string; // 쉼표로 구분
}

const json = (data: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': origin, vary: 'origin' },
  });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('origin') || '';
    const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
    if (!allowed.includes(origin)) return new Response('forbidden', { status: 403 });
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'origin' } });
    }
    if (req.method !== 'POST' || new URL(req.url).pathname !== '/react') return json({ error: 'not_found' }, 404, origin);

    const body = (await req.json().catch(() => null)) as ReactBody | null;
    const bad = invalid(body);
    if (bad || !body) return json({ error: 'bad_request', field: bad }, 400, origin);

    // shortcut: KV 횟수 세기는 동시에 몰리면 몇 번 더 통과할 수 있어요. 사용자가 많아지면 Durable Object나 DB로 바꿔요
    const ip = req.headers.get('cf-connecting-ip') || 'none';
    const keys = { device: dayKey('d', body.device), ip: dayKey('ip', ip), all: dayKey('all', 'all') };
    const [d, i, a] = await Promise.all([keys.device, keys.ip, keys.all].map((k) => env.LIMITS.get(k)));
    const n = { device: Number(d) || 0, ip: Number(i) || 0, all: Number(a) || 0 };
    if (overLimit(n)) return json({ error: 'limit' }, 429, origin);
    // 횟수는 AI 대답이 성공했을 때만 센다 (AI 장애로 하루 한도가 헛되이 줄지 않게)
    const ttl = { expirationTtl: 60 * 60 * 26 };
    const count = () => Promise.all([env.LIMITS.put(keys.device, String(n.device + 1), ttl), env.LIMITS.put(keys.ip, String(n.ip + 1), ttl), env.LIMITS.put(keys.all, String(n.all + 1), ttl)]);

    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${POLICY.model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt(body) }] },
          contents: [{ role: 'user', parts: [{ text: `Call so far:\n${body.history.map((l) => `${l.who === 'ai' ? 'You' : 'Learner'}: ${l.en}`).join('\n')}\n\nLearner just said: ${JSON.stringify(body.said)}` }] }],
          generationConfig: {
            maxOutputTokens: POLICY.maxTokens,
            responseMimeType: 'application/json',
            responseSchema: { type: 'OBJECT', properties: { en: { type: 'STRING' }, ko: { type: 'STRING' } }, required: ['en', 'ko'] },
          },
        }),
      });
      if (!r.ok) {
        console.log('gemini', r.status, (await r.text()).slice(0, 300)); // wrangler tail로 이유 확인 (키·사용자 말은 안 남겨요)
        return json({ error: r.status === 429 ? 'busy' : 'upstream', status: r.status }, 502, origin);
      }
      const d = (await r.json()) as { candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[] };
      const c = d.candidates?.[0];
      if (c?.finishReason !== 'STOP' || !c.content?.parts?.[0]?.text) return json({ error: 'no_reply' }, 502, origin);
      const out = JSON.parse(c.content.parts[0].text) as { en?: string; ko?: string };
      if (!out?.en) return json({ error: 'no_reply' }, 502, origin);
      const en = out.en.slice(0, 200);
      const audio = await speak(en, env.GOOGLE_TTS_KEY);
      if (!audio) return json({ error: 'tts' }, 502, origin); // 목소리 없이 글만 보내지 않아요 (앱은 대본 음성으로 이어가요)
      await count();
      return json({ en, ko: (out.ko || '').slice(0, 200), audio, left: POLICY.perDevicePerDay - n.device - 1 }, 200, origin);
    } catch (e) {
      console.log('error', String(e).slice(0, 200));
      // 실패해도 앱은 대본으로 이어가요
      return json({ error: 'upstream' }, 502, origin);
    }
  },
};

/** Google Chirp 3 HD로 읽은 mp3(base64). 실패하면 null */
async function speak(text: string, key: string): Promise<string | null> {
  const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input: { text }, voice: { languageCode: 'en-US', name: POLICY.voice }, audioConfig: { audioEncoding: 'MP3' } }),
  }).catch(() => null);
  if (!r?.ok) return null;
  const d = (await r.json().catch(() => null)) as { audioContent?: string } | null;
  return d?.audioContent || null;
}
