"""compare_gemini.py와 같은 문장 5개를 ElevenLabs 목소리로 만들어요. 결과: compare/01-en-eleven.m4a ...

사용: python3 compare_eleven.py  (ELEVEN_API_KEY 환경변수 필요, elevenlabs.io > 내 계정 > API Keys)
"""
import json, os, subprocess, sys, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = HERE + '/compare'
KEY = (os.environ.get('ELEVEN_API_KEY') or '').strip()
VOICE = os.environ.get('ELEVEN_VOICE', 'EXAVITQu4vr4xnSDxMaL')  # 기본 제공 목소리 Sarah, 여러 언어 다 읽어요
NO_SPACE = {'ja', 'zh'}
if not KEY or not KEY.isascii(): sys.exit('ELEVEN_API_KEY가 없거나 한글 같은 글자가 섞였어요. 키만 다시 복사해 주세요.')

cards = json.load(open(HERE + '/../../shorts-react/src/data/cards.json'))
picks = []
for l in ['en', 'en', 'ja', 'zh', 'es']:
    c = next(c for c in cards if c['lang'] == l and c not in [p[2] for p in picks])
    picks.append((l, ('' if l in NO_SPACE else ' ').join(c['words']), c))

os.makedirs(OUT, exist_ok=True)
for i, (l, text, _) in enumerate(picks, 1):
    dst = f'{OUT}/{i:02d}-{l}-eleven.m4a'
    req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128',
                                 json.dumps({'text': text, 'model_id': 'eleven_multilingual_v2'}).encode(),
                                 {'Content-Type': 'application/json', 'xi-api-key': KEY})
    try:
        open(dst + '.mp3', 'wb').write(urllib.request.urlopen(req, timeout=120).read())
    except urllib.error.HTTPError as e:
        print('ElevenLabs 실패', e.code, e.read().decode()[:300]); continue
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1', dst + '.mp3', dst], check=True, capture_output=True)
    os.remove(dst + '.mp3')
    print(i, l, text)
print('들어 보세요:', OUT)
