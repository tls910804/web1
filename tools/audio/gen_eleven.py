"""ElevenLabs(eleven_v3, Jessica 목소리)로 앱 음성 파일 만들기. gen_edge.py와 같은 파일 이름이라 그 파일을 덮어써요.

사용: python3 gen_eleven.py [--count]
  키: tools/audio/.eleven_key (compare_voices.py가 저장) 또는 ELEVEN_API_KEY.
  문장 → 표현 → 단어 순서로 만들고, 한도가 다 차면 멈춰요. 다시 실행하면 .eleven3_done.json을 보고 이어서 만들어요.
  아직 못 만든 파일은 예전(Edge) 소리가 그대로 남아 있어서 앱은 계속 잘 돌아가요.
  --count는 만들지 않고 남은 글자 수만 보여 줘요.
"""
import hashlib, json, os, re, subprocess, sys, urllib.error, urllib.request, ast

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(HERE + '/../../shorts-react')
OUT = ROOT + '/public/audio'
KF = HERE + '/.eleven_key'
KEY = (os.environ.get('ELEVEN_API_KEY') or (open(KF).read() if os.path.exists(KF) else '')).strip()
VOICE = os.environ.get('ELEVEN_VOICE', 'cgSgspJ2msm6clMCkdW9')  # Jessica
MODEL = 'eleven_v3'
NO_SPACE = {'ja', 'zh'}

cards = json.load(open(ROOT + '/src/data/cards.json')) + json.load(open(ROOT + '/src/data/videos.json'))
_vc = open(ROOT + '/src/lib/feed.ts').read()
_vc = _vc[_vc.index('const VIDEO_CARD'):]
cards.append({'lang': re.search(r"lang: '(\w+)'", _vc).group(1), 'words': ast.literal_eval(re.search(r'words: (\[.*?\]),', _vc).group(1)), 'expr': re.search(r"expr: '([^']*)'", _vc).group(1)})

def clean(w): return re.sub(r'^[¡¿\s]+|[.,!?。、！？\s]+$', '', w)
def fid(lang, text): return hashlib.sha1(f'{lang}|{text}'.encode()).hexdigest()[:12]

jobs = {}  # (lang,text) -> 0 문장(느린 버전도) / 1 표현 / 2 단어
for c in cards:
    l = c['lang']
    jobs[(l, ('' if l in NO_SPACE else ' ').join(c['words']))] = 0
    if c['expr']: jobs.setdefault((l, re.sub(r'\s*\(.*\)$', '', c['expr'])), 1)
    for w in c['words']:
        t = clean(w)
        if t: jobs.setdefault((l, t), 2)

DONE = HERE + '/.eleven3_done.json'
done = set(json.load(open(DONE))) if os.path.exists(DONE) else set()
todo = []  # (lang, text, kind, suffix, speed, file)
for (l, text), kind in sorted(jobs.items(), key=lambda x: (x[1], x[0])):
    for suffix, speed in [('', 1.0)] + ([('.slow', 0.7)] if kind == 0 else []):
        f = f'{fid(l, text)}{suffix}.m4a'
        if f not in done: todo.append((l, text, kind, suffix, speed, f))

print(f'남은 파일 {len(todo)}개 · 약 {sum(len(t[1]) for t in todo):,}자')
if '--count' in sys.argv: sys.exit()
if not KEY or not KEY.isascii(): sys.exit('ElevenLabs 키가 없거나 한글이 섞였어요. compare_voices.py를 먼저 실행해 키를 저장해 주세요.')

def tts(text, speed, dst):
    body = json.dumps({'text': text, 'model_id': MODEL, 'voice_settings': {'speed': speed}}).encode()
    req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_64', body,
                                 {'xi-api-key': KEY, 'Content-Type': 'application/json'})
    mp3 = dst + '.mp3'
    with urllib.request.urlopen(req, timeout=120) as r, open(mp3, 'wb') as f: f.write(r.read())
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1', mp3, dst], check=True, capture_output=True)
    os.remove(mp3)

manifest = json.load(open(OUT + '/manifest.json'))
made = 0
try:
    for l, text, kind, suffix, speed, f in todo:
        try:
            tts(text, speed, f'{OUT}/{f}')
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:300]
            if e.code in (401, 402, 429) or 'quota' in msg:
                print('한도가 다 찼거나 키 문제로 멈춰요:', e.code, msg); break
            print('FAIL', l, text, e.code, msg); continue
        done.add(f); made += 1
        e = manifest.setdefault(f'{l}|{text}', {'f': f[:12]})
        if kind == 0: e['s'] = 1
        if made % 20 == 0:
            print(made, '/', len(todo), flush=True)
            json.dump(sorted(done), open(DONE, 'w'))
finally:
    json.dump(sorted(done), open(DONE, 'w'))
    json.dump(manifest, open(OUT + '/manifest.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'이번에 {made}개 만들었어요 · 남은 {len(todo) - made}개')
