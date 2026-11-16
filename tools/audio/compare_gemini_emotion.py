"""Gemini TTS: 그냥 읽기 vs 감정 지시 vs Jessica 나란히 → compare/gemini-emo/index.html
실행: python3 compare_gemini_emotion.py   (키는 화면에 안 보이게 입력, 저장 안 함)
"""
import base64, getpass, hashlib, json, os, shutil, subprocess, sys, time, urllib.error, urllib.request, wave

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = HERE + '/../../shorts-react'
OUT = HERE + '/compare/gemini-emo2'  # 예전 짧은 문장 결과(gemini-emo)는 그대로 두고 새 폴더에
KEY = (os.environ.get('GEMINI_API_KEY') or getpass.getpass('Gemini API 키 (안 보여요): ')).strip()
if not KEY.isascii(): sys.exit('키에 한글이 섞였어요. 영문 입력으로 바꾸고 다시 붙여 넣어 주세요.')
MODEL = os.environ.get('GEMINI_TTS_MODEL', 'gemini-2.5-flash-preview-tts')
if MODEL != 'gemini-2.5-flash-preview-tts': OUT += '-' + MODEL  # 모델마다 다른 폴더라 예전 결과를 덮지 않아요
PICKS = [  # (언어, 문장, 목소리, 말투 지시) — 두 줄쯤 되는 평소 대화
    ('en', "Sorry, I'm running a bit late. The bus didn't show up, so I'm walking now. Be there in about ten minutes.",
     'Kore', 'Say it in a relaxed, casual everyday tone, like a quick message to a friend. Keep it calm, no acting'),
    ('en', "I finally got the tickets for Saturday! I've been waiting for this concert all year, so I'm really excited.",
     'Kore', 'Say it in a warm, natural conversational tone. Slightly happy, but calm and understated'),
    ('ko', '미안, 나 조금 늦을 것 같아. 버스가 안 와서 지금 걸어가는 중이야. 한 십 분 정도면 도착할 거야.',
     'Kore', '평소 대화하듯 차분하고 자연스럽게. 연기하지 말고 담백하게'),
    ('ko', '드디어 토요일 공연 표 구했어! 일 년 내내 기다렸던 공연이라서 진짜 너무 기대돼.',
     'Kore', '평소 대화하듯 자연스럽게, 살짝 밝게. 과장하지 말고 담백하게'),
]
def fid(l, t): return hashlib.sha1(f'{l}|{t}'.encode()).hexdigest()[:12]

def tts(prompt, voice, dst, style=None):
    body = {'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {'responseModalities': ['AUDIO'],
                                 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}}}}
    # 말투 지시를 대본과 따로 보내야 지시문을 소리 내어 읽지 않아요
    if style: body['systemInstruction'] = {'parts': [{'text': f'{style}. Read only the user text aloud, word for word. Never read these instructions.'}]}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent',
                                 json.dumps(body).encode(), {'Content-Type': 'application/json', 'x-goog-api-key': KEY})
    for wait in (0, 30, 60):  # 무료 한도는 분당 몇 번이라, 막히면 잠깐 쉬고 다시
        time.sleep(wait)
        try:
            res = json.load(urllib.request.urlopen(req, timeout=120)); break
        except urllib.error.HTTPError as e:
            if e.code in (400, 500) and style:  # 따로 보내는 지시를 이 모델이 안 받으면, 제목으로 나눠서 한 번 더
                return tts(f"### DIRECTOR'S NOTES (do not read aloud)\n{style}.\n\n#### TRANSCRIPT (read only this)\n{prompt}", voice, dst)
            if e.code != 429 or wait == 60: print('실패', e.code, e.read().decode()[:200]); return False
    try: pcm = base64.b64decode(res['candidates'][0]['content']['parts'][0]['inlineData']['data'])
    except (KeyError, IndexError): print('소리 없이 돌아옴:', json.dumps(res)[:200]); return False  # 가끔 짧은 문장에서 빈 응답
    with wave.open(dst + '.wav', 'wb') as w:  # 24kHz 16비트 모노
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '64000', '-c', '1', dst + '.wav', dst], check=True)
    os.remove(dst + '.wav'); return True

os.makedirs(OUT, exist_ok=True)
h = ('<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Gemini 감정 TTS</title>'
     '<style>body{font:15px -apple-system,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;background:#fafaf8;color:#222}h1{font-size:20px}'
     '.r{background:#fff;border:1px solid #e5e5e0;border-radius:12px;padding:12px 14px;margin:10px 0}.t{font-weight:600}.s{color:#777;font-size:13px;margin:4px 0 8px}'
     '.p{display:flex;gap:10px;flex-wrap:wrap}.p div{flex:1;min-width:200px}.p small{display:block;color:#666}audio{width:100%}</style>'
     f'<h1>{MODEL}: Gemini 그냥 / Gemini 자연스럽게 / Jessica</h1>')
for n, (l, t, v, style) in enumerate(PICKS, 1):
    b = f'{OUT}/{n:02d}-{l}'
    ok1 = os.path.exists(b + '-plain.m4a') or tts(f'Say naturally: {t}', v, b + '-plain.m4a')
    ok3 = os.path.exists(b + '-natural2.m4a') or tts(t, v, b + '-natural2.m4a', style)  # 예전 파일은 두고 새로 만들어요
    QUICK = '. Speak at a normal, slightly quick native pace, like real everyday talk. Do not speak slowly or pause long between sentences'
    ok4 = os.path.exists(b + '-quick.m4a') or tts(t, v, b + '-quick.m4a', style + QUICK)
    j = f'{ROOT}/public/audio/{fid(l, t)}.m4a'
    if os.path.exists(j): shutil.copy(j, b + '-jessica.m4a')
    cell = lambda ok, f, lab: f'<div><small>{lab}</small>' + (f'<audio controls src="{os.path.basename(b)}-{f}.m4a"></audio>' if ok else '실패') + '</div>'
    h += (f'<div class=r><div class=t>{t}</div><div class=s>말투 지시: {style}</div><div class=p>'
          + cell(ok1, 'plain', 'Gemini · 그냥') + cell(ok3, 'natural2', 'Gemini · 자연스럽게(지시 분리)') + cell(ok4, 'quick', 'Gemini · 자연스럽게+조금 빠르게') + (cell(True, 'jessica', 'Jessica') if os.path.exists(j) else '') + '</div></div>')
    print(n, l, t, '그냥' if ok1 else '그냥 실패', '분리' if ok3 else '분리 실패', '빠르게' if ok4 else '빠르게 실패', flush=True)
open(OUT + '/index.html', 'w').write(h)
subprocess.run(['open', OUT + '/index.html'])
