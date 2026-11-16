"""최신 Gemini TTS(자연스러운 말투)로 긴 영어·한국어 대화 문장 → Jessica와 나란히: compare/gemini-latest/index.html
실행: python3 compare_gemini_latest.py   (키는 화면에 안 보이게 입력, 저장 안 함)
"""
import base64, getpass, hashlib, json, os, shutil, subprocess, sys, time, urllib.error, urllib.request, wave

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = HERE + '/../../shorts-react'
OUT = HERE + '/compare/gemini-latest'
MODEL = os.environ.get('GEMINI_TTS_MODEL', 'gemini-3.8-flash-tts')
VOICE = 'Kore'
STYLE = 'Say it in a calm, natural everyday conversational tone, like talking to a friend. No acting, understated'
LANGS = {'en': '영어', 'ko': '한국어', 'ja': '일본어', 'zh': '중국어', 'es': '스페인어', 'fr': '프랑스어',
         'de': '독일어', 'pt': '포르투갈어', 'ru': '러시아어', 'vi': '베트남어', 'id': '인도네시아어'}
KEY = (os.environ.get('GEMINI_API_KEY') or getpass.getpass('Gemini API 키 (안 보여요): ')).strip()
if not KEY.isascii(): sys.exit('키에 한글이 섞였어요. 영문 입력으로 바꾸고 다시 붙여 넣어 주세요.')
def fid(l, t): return hashlib.sha1(f'{l}|{t}'.encode()).hexdigest()[:12]

def tts(text, dst):
    # 지시와 대본을 제목으로 확실히 나눠야 지시문까지 소리 내어 읽지 않아요
    prompt = f"### DIRECTOR'S NOTES (do not read aloud)\n{STYLE}.\n\n#### TRANSCRIPT (read only this)\n{text}"
    body = {'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {'responseModalities': ['AUDIO'],
                                 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': VOICE}}}}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent',
                                 json.dumps(body).encode(), {'Content-Type': 'application/json', 'x-goog-api-key': KEY})
    for wait in (0, 30, 60):  # 무료 한도(분당 몇 번)에 걸리면 잠깐 쉬고 다시
        time.sleep(wait)
        try:
            res = json.load(urllib.request.urlopen(req, timeout=120)); break
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:200]
            if e.code != 429 or wait == 60: print('실패', e.code, msg); return False
    try: pcm = base64.b64decode(res['candidates'][0]['content']['parts'][0]['inlineData']['data'])
    except (KeyError, IndexError): print('소리 없이 돌아옴'); return False
    with wave.open(dst + '.wav', 'wb') as w:  # 24kHz 16비트 모노
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '64000', '-c', '1', dst + '.wav', dst], check=True)
    os.remove(dst + '.wav'); return True

cards = json.load(open(ROOT + '/src/data/cards.json'))
os.makedirs(OUT, exist_ok=True)
h = ('<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Gemini 최신 vs Jessica</title>'
     '<style>body{font:15px -apple-system,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;background:#fafaf8;color:#222}h1{font-size:20px}'
     '.r{background:#fff;border:1px solid #e5e5e0;border-radius:12px;padding:12px 14px;margin:10px 0}.t{font-weight:600;margin-bottom:8px}.l{color:#888;font-weight:400;margin-right:6px}'
     '.p{display:flex;gap:10px;flex-wrap:wrap}.p div{flex:1;min-width:220px}.p small{display:block;color:#666}audio{width:100%}</style>'
     f'<h1>Gemini 최신({MODEL}, 자연스럽게) vs Jessica</h1>')
# 긴 대화 문장: compare_voices.py와 같은 글이라 그때 만든 Jessica 파일과 바로 비교돼요
LONG = [('en', '영어', "Hey, sorry I'm late. The traffic was crazy this morning, and I totally forgot my phone at home. "
         "Anyway, did you already order? I'm starving. Let's grab something quick and then go over the plan for tomorrow.",
         HERE + '/compare/voice-eleven_v3-Jessica.m4a'),
        ('ko', '한국어', "아 미안, 좀 늦었지? 오늘 아침에 길이 진짜 막혀서, 휴대폰까지 집에 두고 나왔어. "
         "근데 벌써 주문했어? 나 너무 배고파. 일단 간단하게 뭐 좀 먹고, 내일 계획 얘기하자.",
         HERE + '/compare/voice-eleven_v3-Jessica-ko.m4a')]
# Jessica(밝고 친근한 젊은 여성)에 가까운 Gemini 목소리 후보 — 언어마다 목소리별로 나란히
VOICES = ['Leda', 'Aoede', 'Callirrhoe', 'Laomedeia', 'Sulafat']
for n, (l, name, t, j) in enumerate(LONG, 1):
    h += f'<div class=r><div class=t><span class=l>{name}</span>{t}</div><div class=p>'
    if os.path.exists(j): shutil.copy(j, f'{OUT}/long{n:02d}-{l}-jessica.m4a')
    h += f'<div><small>Jessica (ElevenLabs)</small><audio controls src="long{n:02d}-{l}-jessica.m4a"></audio></div>'
    for v in VOICES:
        VOICE = v
        f = f'long{n:02d}-{l}-{v}.m4a'
        ok = os.path.exists(f'{OUT}/{f}') or tts(t, f'{OUT}/{f}')
        h += f'<div><small>Gemini · {v}</small>' + (f'<audio controls src="{f}"></audio>' if ok else '실패') + '</div>'
        print(l, v, '성공' if ok else '실패', flush=True)
    h += '</div></div>'
    open(OUT + '/index.html', 'w').write(h)  # 중간에 멈춰도 만든 것까지는 들을 수 있게
subprocess.run(['open', OUT + '/index.html'])
