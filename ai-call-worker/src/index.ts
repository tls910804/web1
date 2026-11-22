import Anthropic from '@anthropic-ai/sdk';
import { POLICY, dayKey, invalid, overLimit, systemPrompt, type ReactBody } from './policy';

export interface Env {
  ANTHROPIC_API_KEY: string; // wrangler secret put ANTHROPIC_API_KEY 로만 넣어요(코드·저장소에 두지 않음)
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

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    try {
      const res = await client.messages.create({
        model: POLICY.model,
        max_tokens: POLICY.maxTokens,
        output_config: {
          effort: 'low',
          format: {
            type: 'json_schema',
            schema: { type: 'object', properties: { en: { type: 'string' }, ko: { type: 'string' } }, required: ['en', 'ko'], additionalProperties: false },
          },
        },
        system: systemPrompt(body),
        messages: [
          {
            role: 'user',
            content: `Call so far:\n${body.history.map((l) => `${l.who === 'ai' ? 'You' : 'Learner'}: ${l.en}`).join('\n')}\n\nLearner just said: ${JSON.stringify(body.said)}`,
          },
        ],
      });
      if (res.stop_reason !== 'end_turn') return json({ error: 'no_reply' }, 502, origin);
      const text = res.content.find((c) => c.type === 'text');
      const out = text?.type === 'text' ? (JSON.parse(text.text) as { en: string; ko: string }) : null;
      if (!out?.en) return json({ error: 'no_reply' }, 502, origin);
      await count();
      return json({ en: out.en.slice(0, 200), ko: (out.ko || '').slice(0, 200), left: POLICY.perDevicePerDay - n.device - 1 }, 200, origin);
    } catch (e) {
      // 실패해도 앱은 대본으로 이어가요
      return json({ error: e instanceof Anthropic.RateLimitError ? 'busy' : 'upstream' }, 502, origin);
    }
  },
};
