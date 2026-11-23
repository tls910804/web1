"""Gemini로 만든 문장 음성 받아쓰기 검수: 소리를 글로 받아써서 원래 문장과 다르면 '다시 만들기' 목록에 넣어요.
사용: python3 check_gemini.py --langs ko [--fix]
  50개씩 묶어 받아쓰기 호출 1번 (글 모델이라 음성 만들기 한도와 따로). 실패하면 바로 멈춰요.
  결과: compare/check-<언어>.json. --fix를 붙이면 (받아쓰기 다시 안 하고) 그 결과의 틀린 문장을 .gemini_done.json·manifest에서 빼요
  (파일은 안 지움. 다음 gen_gemini.py 실행 때 다시 만들고, 예전 파일은 backup-before-gemini/에 보관돼요).
"""
import base64, difflib, getpass, json, os, re, sys, time, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO = HERE + '/../../shorts-react/public/audio'
API = 'https://generativelanguage.googleapis.com/v1beta/models'
LANGS = sys.argv[sys.argv.index('--langs') + 1].split(',')
FIX = '--fix' in sys.argv
GROUP = 50
PASS = 0.8  # 글자 비슷한 정도(0~1). 받아쓰기는 띄어쓰기·문장부호·숫자 표기가 달라도 되게 이것들은 빼고 비교해요

def norm(s): return re.sub(r'[\W_]+', '', s.lower())
def same(a, b): return difflib.SequenceMatcher(None, norm(a), norm(b)).ratio()

manifest = json.load(open(AUDIO + '/manifest.json'))
if FIX:  # 받아쓰기는 다시 안 하고, 지난 검수 결과(compare/check-<언어>.json)로 목록에서 빼요
    bad = [b for l in LANGS for b in json.load(open(f'{HERE}/compare/check-{l}.json'))]
    fs = {b['f'] for b in bad}
    done = set(json.load(open(HERE + '/.gemini_done.json')))
    json.dump(sorted(d for d in done if d[:12] not in fs), open(HERE + '/.gemini_done.json', 'w'))
    for k in [k for k, e in manifest.items() if e['f'] in fs]: del manifest[k]
    json.dump(manifest, open(AUDIO + '/manifest.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    sys.exit(f'{len(fs)}개를 다시 만들기 목록에 넣었어요. 이제 gen_gemini.py를 실행하면 새로 만들어요')
items = [(k.split('|', 1)[0], k.split('|', 1)[1], e['f']) for k, e in manifest.items()
         if k.split('|', 1)[0] in LANGS and e.get('v')]  # v가 있는 것 = Gemini로 만든 문장
print(f'검수할 문장 {len(items)}개 · 받아쓰기 호출 약 {-(-len(items) // GROUP)}번')

KEY = (os.environ.get('GEMINI_API_KEY') or getpass.getpass('Gemini API 키 (안 보여요): ')).strip()
if not KEY.isascii(): sys.exit('키에 한글이 섞였어요. 영문 입력으로 바꾸고 다시 붙여 넣어 주세요.')

def call(url, body=None):
    req = urllib.request.Request(url, json.dumps(body).encode() if body else None,
                                 {'Content-Type': 'application/json', 'x-goog-api-key': KEY})
    for tries in range(30):  # 인터넷 끊김(요금 안 나감)만 1분 쉬고 다시, 최대 30분. API 오류(키·한도 등)는 바로 멈춰요
        try: return json.load(urllib.request.urlopen(req, timeout=300))
        except urllib.error.HTTPError as e: sys.exit(f'실패해서 멈춰요: {e.code} {e.read().decode()[:300]}')
        except (urllib.error.URLError, ConnectionError, TimeoutError) as e: print('  인터넷 끊김, 1분 뒤 다시:', e, flush=True); time.sleep(60)
        except Exception as e: sys.exit(f'실패해서 멈춰요: {e}')
    sys.exit('인터넷이 30분 넘게 끊겨서 멈춰요')

names = [m['name'].split('/')[-1] for m in call(API + '?pageSize=200').get('models', [])]
flash = [n for n in names if re.fullmatch(r'gemini-[\d.]+-flash', n)]
if not flash: sys.exit('쓸 수 있는 flash 모델을 못 찾았어요')
MODEL = max(flash, key=lambda n: [int(x) for x in re.findall(r'\d+', n)])
print('받아쓰기 모델:', MODEL)

HEARD = HERE + '/compare/heard.json'  # 파일별 받아쓰기 결과 {f: [파일 수정 시각, 들린 글]} — 끊겨도 이어서 하고, 다시 만든 파일만 다시 검사
heard_all = json.load(open(HEARD)) if os.path.exists(HEARD) else {}
def mtime(f): return int(os.path.getmtime(f'{AUDIO}/{f}.m4a'))
todo = [it for it in items if heard_all.get(it[2], [None])[0] != mtime(it[2])]
print(f'이미 검사한 것 {len(items) - len(todo)}개 · 이번에 검사할 것 {len(todo)}개')
calls = 0
for g in range(0, len(todo), GROUP):
    group = todo[g:g + GROUP]
    parts = [{'text': f'Transcribe each of the {len(group)} audio clips below exactly as spoken, word for word, in the language spoken. '
                      'Do not correct or guess from context: write only what you actually hear. '
                      f'Return a JSON array of {len(group)} strings, one per clip, in order.'}]
    for i, (l, text, f) in enumerate(group):
        parts += [{'text': f'Clip {i + 1}:'},
                  {'inlineData': {'mimeType': 'audio/mp4', 'data': base64.b64encode(open(f'{AUDIO}/{f}.m4a', 'rb').read()).decode()}}]
    res = call(f'{API}/{MODEL}:generateContent', {'contents': [{'parts': parts}],
               'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0}})
    calls += 1
    try: heard = json.loads(res['candidates'][0]['content']['parts'][0]['text'])
    except Exception: sys.exit(f'받아쓰기 결과를 못 읽어서 멈춰요: {str(res)[:300]}')
    if len(heard) != len(group): sys.exit(f'받아쓰기 개수가 달라서 멈춰요: {len(heard)} / {len(group)}')
    for (l, text, f), h in zip(group, heard): heard_all[f] = [mtime(f), h]
    json.dump(heard_all, open(HEARD, 'w'), ensure_ascii=False)  # 묶음마다 저장
    print(f'{g + len(group)} / {len(todo)}', flush=True)

bad = []
for l, text, f in items:
    h = heard_all[f][1]; r = same(text, h)
    if r < PASS: bad.append({'lang': l, 'f': f, 'text': text, 'heard': h, 'score': round(r, 2)})
for l in LANGS:
    json.dump([b for b in bad if b['lang'] == l], open(f'{HERE}/compare/check-{l}.json', 'w'), ensure_ascii=False, indent=1)
for b in bad: print(f"  {b['score']}  {b['text']}  →  들린 것: {b['heard']}")
print(f'끝 · 호출 {calls}번 · 틀린 것 {len(bad)}개 (목록을 보고 다시 만들려면: python3 check_gemini.py --langs {",".join(LANGS)} --fix)')
