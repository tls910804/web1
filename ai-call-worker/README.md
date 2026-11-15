# AI 전화 서버 (Cloudflare Worker)

AI 전화에서 사용자가 **대본에 없는 말**을 했을 때만, AI(Claude Haiku)가 그 말에 짧게 반응해 주는 작은 서버예요.
서버가 없거나 고장 나도 앱은 지금처럼 대본으로 통화해요.

## 운영 정책

| 항목 | 정한 값 | 이유 |
|---|---|---|
| 통화의 뼈대 | 대본(`calls.json`) 그대로 | 품질이 일정하고, 미션 표현을 꼭 연습하게 돼요 |
| AI가 끼어드는 때 | 사용자가 대본과 다른 말을 했을 때, 한 마디에 한 번 | 비용을 꼭 필요한 순간에만 써요 |
| AI 대답 | 영어 한 문장(12단어 이하) + 한국어 뜻 | 쉬운 회화, 바로 다음 대본 대사로 이어져요 |
| 모델 | `claude-haiku-5-5`, effort `low` | 짧은 반응엔 충분하고 가장 싸요 (한 번에 1원 안팎) |
| AI 목소리 | 기기 음성(무료) | 미리 만들 수 없는 문장이라 우선 무료로 |
| 말 인식 | 브라우저 음성 인식(무료) | 지금과 같음 |
| 기기당 한도 | 하루 AI 대답 20번 | 통화 5~6번 분량 |
| 같은 인터넷 주소 한도 | 하루 60번 | 기기 id를 지워 가며 쓰는 것 막기 |
| 전체 한도 | 하루 3,000번 | 갑자기 몰려도 하루 요금이 수천 원을 못 넘게 |
| 한도를 넘으면 | 대본으로만 진행 (앱엔 오류 없음) | |
| 사용자가 한 말 | 200자까지, 앞 대화 6줄까지만 보냄 | 요금과 악용 막기 |
| 받는 곳 | 배포 주소와 개발 미리보기 주소만 | 다른 사이트가 이 서버를 못 쓰게 |
| API 키 | Cloudflare 비밀 값으로만 보관 | 앱·저장소에는 절대 넣지 않아요 |

숫자는 `src/policy.ts`의 `POLICY`에서만 바꿔요. 프리미엄이 생기면 기기 한도를 프리미엄만 늘리면 돼요(로그인 필요).

## 처음 한 번 설정 (직접 해 주세요)

1. Cloudflare 무료 가입 → 터미널에서 `cd ai-call-worker && npm install && npx wrangler login`
2. 횟수 저장소 만들기: `npx wrangler kv namespace create LIMITS` → 나온 `id`를 `wrangler.toml`의 `REPLACE_WITH_KV_ID` 자리에 넣기
3. Anthropic 콘솔(console.anthropic.com)에서 API 키 발급 → `npx wrangler secret put ANTHROPIC_API_KEY` (붙여 넣기, 화면에 안 보여요)
4. 배포: `npm run deploy` → 나온 주소(예: `https://langshort-ai-call.xxx.workers.dev`)를 복사
5. 앱에 연결: `shorts-react/.env.production` 파일에 `VITE_CALL_API=복사한 주소` 한 줄 (개발용은 `.env.local`)
6. Anthropic 콘솔에서 **월 사용 한도**(예: 10달러)를 꼭 걸어 두기 — 마지막 안전장치예요

## 확인

- `npm test` — 정책(요청 검사·한도) 테스트
- `npm run check` — 타입 검사
