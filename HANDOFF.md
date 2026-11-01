# 문장 쇼츠 (Langshort) 인수인계

작성: 2026-11-01. 새 세션에서 이 파일을 먼저 읽고 시작하세요. 한국어로 소통합니다.

## 1. 프로젝트
- 위치: `~/Desktop/바탕화면/코딩/langshort` (예전 경로 `Desktop/정리/...`는 폴더 이름이 바뀌어 더 이상 없음)
- GitHub: `tls910804/web1` (로컬 폴더 이름만 langshort로 바꿈, 저장소 이름은 아직 web1), 브랜치 master, 마지막 푸시 커밋 `fa4cdfc`
- 앱: 한 화면에 문장 하나씩 넘겨 보는 모바일 우선 언어 학습 앱, UI는 한국어
- `shorts/`: 예전 바닐라 HTML/CSS/JS 앱 (무채색 장부 스타일, 캐시 v=10)
- `shorts-react/`: Vite 6 + React 18 + TypeScript(strict) 이식판. base `./`
- 배포: GitHub Actions(`.github/workflows/pages.yml`) → https://tls910804.github.io/web1/shorts-react/ (옛 앱: `/web1/shorts/`)
  - Pages build_type은 "workflow". 옛 방식 배포가 덮어쓰면 `gh workflow run pages.yml`로 다시 배포
- 상태 저장: localStorage `sentence-shorts-v1` (옛 앱과 같은 스키마)

## 2. 사용자 작업 규칙
- 커밋/푸시/배포는 사용자가 명시적으로 말할 때만 ("커밋해줘", "배포진행해")
- 단계별로 승인받으며 진행, 목소리는 직접 듣고 확정함
- 인스타 등 로그인 벽 페이지는 계정 생성/로그인 불가, 내용은 사용자가 붙여 넣어야 함

## 3. 커밋 안 된 작업 (사용자 승인 대기)
"커밋해둘까요?" 질문에 아직 답이 없음.
- 오디오 기능: `shorts-react/public/audio/`(m4a 557개 + manifest.json, 6.2MB), `src/lib/audio.ts`, `src/vite-env.d.ts`, `src/ui.tsx` 수정(speak가 `playAudio` 먼저 시도, `go()`에서 `stopAudio()`)
- `tools/audio/`(synth.py, gen.py, pick.json, README.md): Piper onnx 음성을 직접 만든 합성기로 돌려 미리 생성
- 목업: `shorts/mockup.html`, `shorts-react/public/mockup.html`
- `참고자료/` 폴더(랭플릭스 참고 PNG 3장)
- `.DS_Store`는 커밋 제외 권장
- 이 `HANDOFF.md`도 새 파일

## 4. 오디오 방식 (목소리 교체 가능)
- `manifest.json`이 `언어|문장` → 파일 해시로 연결, 느리게는 `.slow.m4a`
- 파일이 없으면 `speechSynthesis`로 대체 재생
- 다른 목소리로 바꾸려면 `tools/audio/pick.json`의 음성 선택을 바꾸고 `gen.py`로 다시 생성

## 5. Figma
- 파일: https://www.figma.com/design/pgYwh1CZY0EFZxwvHVKNCP/Langshort (fileKey `pgYwh1CZY0EFZxwvHVKNCP`)
- 페이지: `design`(0:1, 주 작업), `components`(4:332), `document`(10:886), `design 시안`(122:7305, 지금은 비어 있음, 사용자가 그대로 두라고 함)
- 색 변수 컬렉션 `VariableCollectionId:4:333`, 모드 Dark(4:0) / Light(8:1) / Ledger(114:0). **라이트 화면은 Ledger 모드**로 통일함
- `design` 페이지 섹션 (페이지 > 섹션 > 화면, 두 단계):
  1. 첫 실행 → 랜딩 (7단계: 스플래시, 내 언어, 배울 언어+미리보기, 둘러보기 첫 진입, 넘기기 힌트, 로그인, 알림 허용)
  2. 둘러보기
  3. 배울래요 · 복습 · 기록
  4. 설정 · 계정
  5. 알림 · 빈 화면 · 오류
  6. 다크 모드 (핵심 4화면만)
  7. 불멍 탭 시안 (`130:3551`, 다크 고정, 모닥불 벡터 그래픽)
- 기존과 겹치던 5개 화면(스플래시, 언어 선택, 둘러보기 첫 카드, 로그인 시트, 온보딩 알림 안내)과 섞여 있던 "장부" 시안 4장은 삭제함
- 알려진 문제: `get_screenshot`이 첫 호출에서 "transport dropped"로 자주 실패함 → 같은 호출을 다시 하면 됨
- 사용 컴포넌트: Chip, Button(Kind=Primary), Button/Link, Button/Provider, Tab, Toast, Icon button 등

## 6. 결정된 것 / 미룬 것
- 확정한 첫 실행 흐름: 팝업 없이 곧바로 첫 카드, 힌트는 한 번에 하나, 알림 허용은 첫 저장 직후, 로그인은 알림 다음 한 번만
- 미룸: 내 언어에 따라 앱 전체 UI를 현지 언어로 보여 주는 번역(i18n). 사용자가 "이따 다시 고려"라고 함
- 아이디어: 불멍 탭(차분한 목소리로 문장을 하나씩 들려줌). 시안만 있음. 탭으로 둘지 둘러보기 안의 모드로 둘지, 화면이 꺼져도 소리가 나오는지(웹앱 한계)는 미정
- 새로 정리한 첫 실행 흐름을 React 앱 코드에 반영하는 일은 아직 안 함
- GitHub 저장소 이름 web1 → langshort 변경 제안은 답 없음 (바꾸면 Pages 주소가 바뀜)

## 7. 이 세션에서 설치한 도구
- uv 0.13.6 (Homebrew)
- ponytail 5.3.3: 플러그인, user 범위, enabled. 새 세션부터 자동 적용. `/ponytail-help`로 확인
- graphify 0.9.100: 스킬은 `~/.claude/skills/graphify/`, `~/.claude/CLAUDE.md`에 두 줄 추가됨. 새 세션에서 `/graphify .`로 호출. 지우려면 `graphify uninstall`
- headroom 0.42.0: 터미널에서 `headroom wrap claude`로 띄운 세션에서만 압축 적용 (이 앱 세션에는 적용 안 됨). Serena 연결이 싫으면 `--code-memory none`. 되돌리기 `headroom unwrap claude`
- 설치 명령은 권한 분류기가 막은 적이 있어, ponytail은 사용자가 터미널에서 직접 `claude plugin ...`으로 설치함

## 8. 개발 환경 주의
- macOS 앱에서 띄운 프로세스는 Desktop 접근 권한이 없어 `getcwd` 오류가 남 → 서버는 Bash 도구로 실행
- `sed -i`는 맥에서 `''`가 필요하니 파이썬으로 수정, `timeout` 명령 없음
- 브라우저 패널 위치는 도구로 못 옮김 (사용자가 직접 끌어야 함)
- 임시 파일 위치(세션이 바뀌면 달라질 수 있음): 스크래치패드의 `voices/`(약 800MB), `venv`(py3.12)

## 9. 다음 후보 (우선순위 제안)
1. 오디오/목업/참고자료 커밋 여부 사용자 확인 → 승인 시 커밋
2. 새 첫 실행 흐름을 React 앱에 적용 (2단계 언어 선택, 미리보기, 알림 지연 요청)
3. 불멍 탭 방향 확정 후 구현
4. UI 현지화(i18n) 재논의
