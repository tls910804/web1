# AI 전화 서버 (Cloudflare Worker)

AI 전화에서 사용자가 말할 때마다 AI(Gemini Flash-Lite)가 반응하며 다음 대사를 만들고, Google Chirp 3 HD 목소리로 읽어 보내는 작은 서버예요.
첫인사는 미리 만든 파일(`tools/audio/gen_call_chirp.py`)이에요. 서버가 없거나 실패하면 앱은 대본(미리 만든 음성)으로 이어가요.

## 운영 정책

| 항목 | 정한 값 | 이유 |
|---|---|---|
| 통화의 뼈대 | 대본(`calls.json`)의 흐름만 안내로 | AI가 사용자 말에 맞춰 자기 말로 이어가요 |
| AI가 말하는 때 | 사용자가 말하거나 고를 때마다 한 번 (첫인사 제외) | |
| AI 대답 | 영어 1~2문장(25단어 이하) + 한국어 뜻 | 마지막 차례엔 작별 인사 |
| 모델 | `gemini-flash-lite-latest` | 짧은 회화엔 충분하고 아주 싸요 (한 번에 0.1~0.2원) |
| AI 목소리 | Google Chirp 3 HD `en-US-Chirp3-HD-Kore` | 빠르고(0.3초 안팎) 한 번에 3원 안팎. 목소리를 못 만들면 글만 보내지 않고 대본으로 |
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
3. Google Cloud 콘솔에서 Text-to-Speech API 켜기 → API 키 만들기(그 API만 쓰게 제한) → `npx wrangler secret put GOOGLE_TTS_KEY`
   Gemini 키는 따로: Google AI Studio(aistudio.google.com/apikey)에서 같은 프로젝트로 만들기 → `npx wrangler secret put GEMINI_KEY`
4. 배포: `npm run deploy` → 나온 주소(예: `https://langshort-ai-call.xxx.workers.dev`)를 복사
5. 앱에 연결: `shorts-react/.env.production` 파일에 `VITE_CALL_API=복사한 주소` 한 줄 (개발용은 `.env.local`)
6. Google Cloud 결제에서 **예산 알림**(예: 월 1만 원)을 꼭 걸어 두기 — 마지막 안전장치예요

## 확인

- `npm test` — 정책(요청 검사·한도) 테스트
- `npm run check` — 타입 검사
