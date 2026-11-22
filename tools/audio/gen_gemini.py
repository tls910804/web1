"""Gemini 3.8 TTS(Kore, 자연스럽게+조금 빠르게)로 앱의 문장 음성 만들기. 느리게는 앱이 이 파일을 0.75배로 틀어요(.slow 파일 안 만듦). 표현·단어는 예전 소리 그대로 둬요.

사용: python3 gen_gemini.py [--count] [--limit N] [--langs en,ko,id] [--batch N]
  키는 화면에 안 보이게 입력, 저장 안 함.
  덮어쓰기 전에 원래 파일을 backup-before-gemini/ 에 복사해 둬요(Jessica·Edge 원본 보관).
  .gemini_done.json을 보고 이어서 만들어요. --limit N은 문장 N개만 만들고 멈춰요(시험용).
  --batch N은 같은 언어 문장 N개를 한 번 호출로 읽게 하고 쉰 곳에서 잘라요(하루 호출 한도 절약). 잘 안 잘리면 한 문장씩 다시 만들어요.
"""
from trim_tail import split, trim
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
BATCH = int(sys.argv[sys.argv.index('--batch') + 1]) if '--batch' in sys.argv else 1
KEY = (os.environ.get('GEMINI_API_KEY') or getpass.getpass('Gemini API 키 (안 보여요): ')).strip()
if not KEY.isascii(): sys.exit('키에 한글이 섞였어요. 영문 입력으로 바꾸고 다시 붙여 넣어 주세요.')

class Stop(Exception): pass

calls = 0
def speak(text, style):
    """Gemini에 한 번 호출해서 소리(PCM)를 받아요. 실패하면 None"""
    global calls; calls += 1
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
            if e.code not in (429, 500, 503) or wait == 60: print('실패', e.code, msg); return None
    try: return base64.b64decode(res['candidates'][0]['content']['parts'][0]['inlineData']['data'])
    except (KeyError, IndexError): print('소리 없이 돌아옴'); return None

def save(pcm, dst):
    pcm = trim(pcm)  # 끝에 붙는 '치지직' 잡음 잘라내기
    tmp = dst + '.wav'
    with wave.open(tmp, 'wb') as w:  # 24kHz 16비트 모노
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
    if os.path.exists(dst) and not os.path.exists(f'{BACKUP}/{os.path.basename(dst)}'):
        os.makedirs(BACKUP, exist_ok=True); shutil.copy2(dst, BACKUP)  # 원래 소리는 지우지 않고 보관
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1', tmp, dst], check=True, capture_output=True)
    os.remove(tmp)

BATCH_NOTE = ('. Read each line below as its own separate sentence, in order. '
              'After each line, stay completely silent for about one full second before the next line. Do not add any words')
def tts_many(group):
    """같은 언어 문장 여러 개 → 파일 이름별 PCM. 한 번에 잘 안 되면 한 문장씩"""
    if len(group) > 1:
        pcm = speak('\n\n'.join(t[1] for t in group), group[0][3] + BATCH_NOTE)
        parts = pcm and split(pcm, [t[1] for t in group])
        if parts: return dict(zip((t[4] for t in group), parts))
        if pcm:  # 왜 실패했는지 들어 볼 수 있게 남겨요 (compare/는 git에 안 올라가요)
            os.makedirs(HERE + '/compare', exist_ok=True)
            with wave.open(f'{HERE}/compare/batch-fail-{int(time.time())}.wav', 'wb') as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
        print(f'  묶음 {len(group)}개를 잘 못 잘라서 한 문장씩 만들어요')
    out = {}
    for t in group:
        p = speak(t[1], t[3])
        if p: out[t[4]] = p
    return out

manifest = json.load(open(OUT + '/manifest.json'))
made = 0
try:
    work = todo[:limit]
    groups = []  # 같은 언어끼리 BATCH개씩
    for t in work:
        if groups and len(groups[-1]) < BATCH and groups[-1][0][0] == t[0]: groups[-1].append(t)
        else: groups.append([t])
    for group in groups:
      got = tts_many(group)
      for l, text, kind, style, f in group:
        if f not in got: print('FAIL', l, text); continue
        save(got[f], f'{OUT}/{f}')
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
    print(f'이번에 {made}개 만들었어요 · 호출 {calls}번 · 남은 {len(todo) - made}개')
