"""긴 문장으로 목소리 비교. 사용: python3 compare_long.py edge|gemini|eleven  → compare/long-en-edge.m4a ...
gemini는 GEMINI_API_KEY, eleven은 ELEVEN_API_KEY 환경변수가 필요해요."""
import asyncio, base64, json, os, subprocess, sys, urllib.error, urllib.request, wave

OUT = os.path.dirname(os.path.abspath(__file__)) + '/compare'
TEXTS = {
    'en': "Hey, sorry I'm late. The traffic was crazy this morning, and I totally forgot my phone at home. "
          "Anyway, did you already order? I'm starving. Let's grab something quick and then go over the plan for tomorrow.",
    'ja': "ごめん、ちょっと遅れちゃった。今朝は電車がすごく混んでて、しかもスマホを家に忘れちゃったんだ。"
          "もう注文した？お腹すいたから、何か軽く食べてから明日の予定を話そうよ。",
}
EDGE = {'en': 'en-US-AriaNeural', 'ja': 'ja-JP-NanamiNeural'}
who = sys.argv[1] if len(sys.argv) > 1 else 'edge'

def to_m4a(src, dst):
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '64000', '-c', '1', src, dst], check=True, capture_output=True)
    os.remove(src)

def post(url, body, headers):
    req = urllib.request.Request(url, json.dumps(body).encode(), {'Content-Type': 'application/json', **headers})
    return urllib.request.urlopen(req, timeout=180).read()

def make(lang, text, dst):
    if who == 'edge':
        import edge_tts
        asyncio.run(edge_tts.Communicate(text, EDGE[lang]).save(dst + '.mp3')); to_m4a(dst + '.mp3', dst)
    elif who == 'gemini':
        res = json.loads(post('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent',
            {'contents': [{'parts': [{'text': f'Say naturally, like a native speaker chatting with a friend: {text}'}]}],
             'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': 'Kore'}}}}},
            {'x-goog-api-key': os.environ['GEMINI_API_KEY'].strip()}))
        with wave.open(dst + '.wav', 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
            w.writeframes(base64.b64decode(res['candidates'][0]['content']['parts'][0]['inlineData']['data']))
        to_m4a(dst + '.wav', dst)
    else:
        mp3 = post('https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL?output_format=mp3_44100_128',
                   {'text': text, 'model_id': 'eleven_multilingual_v2'}, {'xi-api-key': os.environ['ELEVEN_API_KEY'].strip()})
        open(dst + '.mp3', 'wb').write(mp3); to_m4a(dst + '.mp3', dst)

for lang, text in TEXTS.items():
    try:
        make(lang, text, f'{OUT}/long-{lang}-{who}.m4a'); print('OK', lang, who)
    except urllib.error.HTTPError as e:
        print('실패', lang, who, e.code, e.read().decode()[:200])
