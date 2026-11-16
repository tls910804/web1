"""Gemini 3.8 TTS(Kore, 자연스럽게+조금 빠르게)로 앱의 문장 음성 만들기. 느리게는 앱이 이 파일을 0.75배로 틀어요(.slow 파일 안 만듦). 표현·단어는 예전 소리 그대로 둬요.

사용: python3 gen_gemini.py [--count] [--limit N] [--langs en,ko,id]
  키는 화면에 안 보이게 입력, 저장 안 함.
  덮어쓰기 전에 원래 파일을 backup-before-gemini/ 에 복사해 둬요(Jessica·Edge 원본 보관).
  .gemini_done.json을 보고 이어서 만들어요. --limit N은 N개만 만들고 멈춰요(시험용).
"""
import ast, base64, getpass, hashlib, json, os, re, shutil, subprocess, sys, time, urllib.error, urllib.request, wave

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(HERE + '/../../shorts-react')
OUT = ROOT + '/public/audio'
BACKUP = HERE + '/backup-before-gemini'
MODEL = os.environ.get('GEMINI_TTS_MODEL', 'gemini-3.8-flash-tts')
VOICE = 'Kore'
NO_SPACE = {'ja', 'zh'}
STYLE = ('Say it in a calm, natural everyday conversational tone, like talking to a friend. No acting, understated. '
         'Speak at a normal, slightly quick native pace, like real everyday talk. Do not speak slowly or pause long between sentences')
SLOW = ('Say it in a calm, natural conversational tone. Speak slowly and clearly so a language learner can follow every word, '
        'but keep it sounding like a real person, not robotic')

cards = json.load(open(ROOT + '/src/data/cards.json')) + json.load(open(ROOT + '/src/data/videos.json'))
_vc = open(ROOT + '/src/lib/feed.ts').read()
_vc = _vc[_vc.index('const VIDEO_CARD'):]
cards.append({'lang': re.search(r"lang: '(\w+)'", _vc).group(1), 'words': ast.literal_eval(re.search(r'words: (\[.*?\]),', _vc).group(1)), 'expr': re.search(r"expr: '([^']*)'", _vc).group(1)})
def fid(lang, text): return hashlib.sha1(f'{lang}|{text}'.encode()).hexdigest()[:12]

jobs = {}  # (lang,text) -> 0 문장(느린 버전도) — gen_eleven.py와 같은 규칙, 표현·단어는 뺌
LANGS = sys.argv[sys.argv.index('--langs') + 1].split(',') if '--langs' in sys.argv else None
for c in cards:
    l = c['lang']
    if LANGS and l not in LANGS: continue
    jobs[(l, ('' if l in NO_SPACE else ' ').join(c['words']))] = 0

DONE = HERE + '/.gemini_done.json'
done = set(json.load(open(DONE))) if os.path.exists(DONE) else set()
todo = []  # (lang, text, kind, style, file)
for (l, text), kind in sorted(jobs.items(), key=lambda x: (x[1], x[0])):
    for suffix, style in [('', STYLE)]:
        f = f'{fid(l, text)}{suffix}.m4a'
        if f not in done: todo.append((l, text, kind, style, f))

print(f'남은 파일 {len(todo)}개 · 문장 {sum(t[2] == 0 for t in todo)} · 표현 {sum(t[2] == 1 for t in todo)}')
if '--count' in sys.argv: sys.exit()
limit = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else len(todo)
KEY = (os.environ.get('GEMINI_API_KEY') or getpass.getpass('Gemini API 키 (안 보여요): ')).strip()
if not KEY.isascii(): sys.exit('키에 한글이 섞였어요. 영문 입력으로 바꾸고 다시 붙여 넣어 주세요.')

class Stop(Exception): pass

def tts(text, style, dst):
    # 지시와 대본을 제목으로 나눠야 지시문을 소리 내어 읽지 않아요(systemInstruction은 이 모델에서 500)
    prompt = f"### DIRECTOR'S NOTES (do not read aloud)\n{style}.\n\n#### TRANSCRIPT (read only this)\n{text}"
    body = {'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {'responseModalities': ['AUDIO'],
                                 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': VOICE}}}}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent',
                                 json.dumps(body).encode(), {'Content-Type': 'application/json', 'x-goog-api-key': KEY})
    for wait in (0, 20, 60):  # 분당 한도(429)·일시 오류(500/503)는 잠깐 쉬고 다시
        time.sleep(wait)
        try:
            res = json.load(urllib.request.urlopen(req, timeout=120)); break
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:200]
            if e.code in (401, 402, 403): raise Stop(f'{e.code} {msg}')
            if e.code not in (429, 500, 503) or wait == 60: print('실패', e.code, msg); return False
    try: pcm = base64.b64decode(res['candidates'][0]['content']['parts'][0]['inlineData']['data'])
    except (KeyError, IndexError): print('소리 없이 돌아옴'); return False
    tmp = dst + '.wav'
    with wave.open(tmp, 'wb') as w:  # 24kHz 16비트 모노
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
    if os.path.exists(dst) and not os.path.exists(f'{BACKUP}/{os.path.basename(dst)}'):
        os.makedirs(BACKUP, exist_ok=True); shutil.copy2(dst, BACKUP)  # 원래 소리는 지우지 않고 보관
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1', tmp, dst], check=True, capture_output=True)
    os.remove(tmp); return True

manifest = json.load(open(OUT + '/manifest.json'))
made = 0
try:
    for l, text, kind, style, f in todo[:limit]:
        if not tts(text, style, f'{OUT}/{f}'): print('FAIL', l, text); continue
        done.add(f); made += 1
        e = manifest.setdefault(f'{l}|{text}', {'f': f[:12]})
        e.pop('s', None)  # 예전 느린 파일(Jessica) 대신 새 소리를 느리게 틀도록
        if made % 10 == 0:
            print(made, '/', len(todo), flush=True)
            json.dump(sorted(done), open(DONE, 'w'))
except Stop as e:
    print('키나 결제 문제로 멈춰요:', e)
finally:
    json.dump(sorted(done), open(DONE, 'w'))
    json.dump(manifest, open(OUT + '/manifest.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'이번에 {made}개 만들었어요 · 남은 {len(todo) - made}개')
