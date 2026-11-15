"""Edge TTS와 Gemini TTS를 같은 문장 5개로 만들어 나란히 들어 보기. 앱 파일은 건드리지 않아요.

사용: export GEMINI_API_KEY=...  (AI Studio에서 발급, 터미널에서 직접)
      python3 compare_gemini.py
결과: tools/audio/compare/ 에 01-en-edge.m4a, 01-en-gemini.m4a ...
"""
import asyncio, base64, json, os, subprocess, sys, urllib.request, wave
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = HERE + '/compare'
KEY = (os.environ.get('GEMINI_API_KEY') or '').strip()
if KEY and not KEY.isascii(): sys.exit('키에 한글 같은 글자가 섞였어요. AI Studio에서 키만 다시 복사해 붙여 넣어 주세요.')
MODEL = os.environ.get('GEMINI_TTS_MODEL', 'gemini-2.5-flash-preview-tts')  # 이름이 바뀌면 이 값만 바꿔요
GVOICE = {'en': 'Kore', 'ja': 'Kore', 'zh': 'Kore', 'es': 'Kore'}
EVOICE = {'en': 'en-US-AriaNeural', 'ja': 'ja-JP-NanamiNeural', 'zh': 'zh-CN-XiaoxiaoNeural', 'es': 'es-ES-ElviraNeural'}
NO_SPACE = {'ja', 'zh'}

if not KEY: sys.exit('GEMINI_API_KEY가 없어요. 터미널에서 export GEMINI_API_KEY=... 를 먼저 해 주세요.')

cards = json.load(open(HERE + '/../../shorts-react/src/data/cards.json'))
picks, want = [], ['en', 'en', 'ja', 'zh', 'es']
for l in want:
    c = next(c for c in cards if c['lang'] == l and c not in [p[2] for p in picks])
    picks.append((l, ('' if l in NO_SPACE else ' ').join(c['words']), c))

def m4a(src, dst):
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1', src, dst], check=True, capture_output=True)
    os.remove(src)

def gemini(text, lang, dst):
    body = {'contents': [{'parts': [{'text': f'Say naturally, like a native speaker chatting with a friend: {text}'}]}],
            'generationConfig': {'responseModalities': ['AUDIO'],
                                 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': GVOICE[lang]}}}}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent',
                                 json.dumps(body).encode(), {'Content-Type': 'application/json', 'x-goog-api-key': KEY})
    res = json.load(urllib.request.urlopen(req, timeout=120))
    pcm = base64.b64decode(res['candidates'][0]['content']['parts'][0]['inlineData']['data'])
    with wave.open(dst + '.wav', 'wb') as w:  # Gemini는 24kHz 16비트 모노 PCM을 줘요
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
    m4a(dst + '.wav', dst)

async def main():
    os.makedirs(OUT, exist_ok=True)
    for i, (l, text, _) in enumerate(picks, 1):
        base = f'{OUT}/{i:02d}-{l}'
        await edge_tts.Communicate(text, EVOICE[l]).save(base + '-edge.mp3')
        m4a(base + '-edge.mp3', base + '-edge.m4a')
        try:
            gemini(text, l, base + '-gemini.m4a')
        except urllib.error.HTTPError as e:
            print('Gemini 실패', e.code, e.read().decode()[:300]); continue
        print(i, l, text)
    print('들어 보세요:', OUT)

asyncio.run(main())
