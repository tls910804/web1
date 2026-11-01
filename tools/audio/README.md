# 음성 파일 만들기

`shorts-react/public/audio/`의 음성은 오픈소스 [Piper](https://github.com/OHF-Voice/piper1-gpl) 음성 모델로 미리 만든 파일이에요.
`gen.py`가 `cards.json`의 모든 문장·단어·표현을 읽어 m4a와 `manifest.json`을 만들어요. 파일이 없는 문장(직접 추가한 문장)은 앱이 브라우저 기본 음성으로 읽어요.

## 다시 만들기 (macOS)
1. `brew install python@3.12 espeak-ng`
2. `python3.12 -m venv venv && venv/bin/pip install piper-tts pyopenjtalk-plus onnxruntime`
3. `pick.json`의 음성 11개를 https://huggingface.co/rhasspy/piper-voices 에서 받아 `voices/`에 둬요 (`.onnx` + `.onnx.json`).
4. `venv/bin/python gen.py`

(piper-tts 1.8.0의 macOS 휠은 espeak 데이터 경로 오류가 있어서, `synth.py`가 모델을 onnxruntime으로 직접 돌리고 발음 기호는 `espeak-ng` 명령으로 만들어요.)

## 음성 라이선스
| 언어 | 음성 | 라이선스 |
|---|---|---|
| 영어 | en_US-lessac-high | Blizzard 2013 라이선스 (링크 확인 필요) |
| 한국어 | ko_KR-kss-medium | CC BY-NC-SA 4.0 (비영리) |
| 일본어 | ja_JP-hi_fi_captain-medium | CC BY-NC-SA 4.0 (비영리) |
| 중국어 | zh_CN-huayan-medium | 표기 없음 |
| 스페인어 | es_ES-davefx-medium | CC0 |
| 프랑스어 | fr_FR-siwis-medium | CC BY 4.0 (출처 표기) |
| 독일어 | de_DE-thorsten-high | CC0 |
| 포르투갈어 | pt_BR-faber-medium | CC0 |
| 러시아어 | ru_RU-irina-medium | 표기 없음 |
| 베트남어 | vi_VN-vais1000-medium | CC BY 4.0 (출처 표기) |
| 인도네시아어 | id_ID-news_tts-medium | 링크 확인 필요 |

한국어·일본어 음성은 **비영리 전용**이라, 앱을 유료로 내거나 광고를 붙이면 쓰면 안 돼요.
