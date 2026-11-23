"""Gemini 목소리 비교: 목소리마다 영어 1문장 + 한국어 1문장 (각각 호출 1번) → shorts-react/public/voices.html
실행: python3 compare_bright.py   (키는 화면에 안 보이게 입력, 저장 안 함). 실패하면 바로 멈춰요.
(두 사람 대화 기능 multiSpeakerVoiceConfig는 이 모델에서 400 오류라 안 써요)
"""
import base64, getpass, json, os, sys, urllib.error, urllib.request, wave

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = HERE + '/../../shorts-react/public'
MODEL = 'gemini-3.8-flash-tts'
VOICES = ['Puck', 'Iapetus']  # 남자 목소리 (Puck: 밝음, Iapetus: 또렷함)
STYLE = ('Say it in a calm, natural everyday conversational tone, like talking to a friend. No acting, understated. '
         'Speak at a normal, slightly quick native pace, like real everyday talk')
LINES = {'en': "I was going to call you last night, but I fell asleep on the couch before I knew it.",
         'ko': '어제 전화하려고 했는데, 소파에서 나도 모르게 잠들어 버렸어.'}
KEY = getpass.getpass('Gemini API 키 (안 보여요): ').strip()
if not KEY.isascii(): sys.exit('키에 한글이 섞였어요. 영문 입력으로 바꾸고 다시 붙여 넣어 주세요.')
os.makedirs(PUB + '/bright', exist_ok=True)

rows = ''
for v in VOICES:
    for lang, text in LINES.items():
        prompt = f"### DIRECTOR'S NOTES (do not read aloud)\n{STYLE}.\n\n#### TRANSCRIPT (read only this)\n{text}"
        body = {'contents': [{'parts': [{'text': prompt}]}],
                'generationConfig': {'responseModalities': ['AUDIO'],
                                     'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': v}}}}}
        req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent',
                                     json.dumps(body).encode(), {'Content-Type': 'application/json', 'x-goog-api-key': KEY})
        try:
            res = json.load(urllib.request.urlopen(req, timeout=120))
            pcm = base64.b64decode(res['candidates'][0]['content']['parts'][0]['inlineData']['data'])
        except urllib.error.HTTPError as e:
            sys.exit(f'{v} {lang} 실패해서 멈춰요: {e.code} {e.read().decode()[:300]}')
        except Exception as e:
            sys.exit(f'{v} {lang} 실패해서 멈춰요: {e}')
        with wave.open(f'{PUB}/bright/{v}-{lang}.wav', 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
        rows += f'<tr><th>{v} ({lang})</th><td><audio controls src="bright/{v}-{lang}.wav"></audio></td></tr>'
        print(v, lang, '완료')
rows += ''.join(f'<tr><th>Leda ({l}, 지금)</th><td><audio controls src="bright/{f}"></audio></td></tr>'
                for l, f in (('en', 'Leda.wav'), ('ko', 'Leda-ko.wav')))
open(PUB + '/voices.html', 'w').write(
    '<!doctype html><meta charset=utf-8><title>목소리 비교</title><style>body{font-family:sans-serif;background:#faf9f6;padding:16px}td,th{padding:6px;text-align:left}</style>'
    f'<table>{rows}</table>')
print('끝: http://localhost:5175/voices.html')
