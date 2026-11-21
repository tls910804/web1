# 새 문장 초안 (아직 앱에 안 넣음)

- `new-cards.json`: 90문장 (영어 40 · 한국어 25 · 인도네시아어 25). 앱 cards.json과 같은 형식, id는 `draft-…`.
  - 상황: 일상·일·업무·여행·카페·식당·감정 + 새로 슬랭·연애·드라마·영화(`tab`)
  - 난이도: 초급·중급·고급 섞음
- `new-gloss.json`: 영어·인도네시아어 단어별 뜻 (한국어 카드는 없음)

넣는 법: 고를 문장만 `shorts-react/src/data/cards.json` 끝에 붙이고 id를 앱 규칙(en41…)으로 바꾸면 돼요.
음성은 `tools/audio/gen_gemini.py --langs en,ko,id`로 새 문장만 만들어져요.
