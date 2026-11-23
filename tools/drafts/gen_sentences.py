"""Gemini로 새 문장 초안을 만들어요. 앱에는 안 넣고 {lang}-batches/30-gemini.txt에만 써요.

사용: python3 gen_sentences.py --lang es [--count 200] [--model 이름]
  키는 실행할 때 직접 입력(화면에 안 보여요). 형식이 틀린 줄은 버리고 모자라면 더 요청해요.
  끝나면 en_build.py --lang es 로 검사하고, 괜찮으면 --merge로 합쳐요.
"""
import getpass, json, os, re, sys, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = HERE + '/../../shorts-react/src/data'
arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
LANG, COUNT, PER = arg('--lang', ''), int(arg('--count', '200')), 50
NAMES = {'es': 'Spanish', 'fr': 'French', 'de': 'German', 'pt': 'Brazilian Portuguese', 'ru': 'Russian',
         'vi': 'Vietnamese', 'id': 'Indonesian', 'ja': 'Japanese', 'zh': 'Simplified Chinese', 'en': 'English'}
if LANG not in NAMES: sys.exit('--lang 을 es fr de pt ru vi id ja zh en 중에서 골라 주세요')
OUT = f'{HERE}/{LANG}-batches/30-gemini.txt'
CATS = '일상 감정 회사 여행 카페·식당 쇼핑 병원 연애'.split()
TABS = {'', '슬랭', '연애', '드라마·영화'}
norm = lambda s: re.sub(r'[\W_]+', '', s.lower())


def valid(line):
    """en_build.py와 같은 형식 검사. 맞으면 (문장 키, 줄), 틀리면 None"""
    p = [x.strip() for x in line.split('|')]
    if len(p) == 8: p.append('')
    if len(p) != 9 or p[0] not in ('초', '중', '고') or p[1] not in CATS + ['드라마·영화'] or p[2] not in TABS: return None
    parts = [x.strip() for x in p[3].split('/') if x.strip()]
    key = [i for i, x in enumerate(parts) if x.startswith('*')]
    if not key or key != list(range(key[0], key[-1] + 1)) or any('*' in x[1:] for x in parts): return None
    gloss = [x for x in p[8].split(';') if x.strip()] if p[8] else []
    if len(gloss) != len(parts) - len(key) or not all(p[4:8]): return None
    return norm(''.join(x.lstrip('*') for x in parts)), '|'.join(p)


cards = json.load(open(DATA + '/cards.json'))
seen = {norm(''.join(c['words'])) for c in cards if c['lang'] == LANG}
if os.path.exists(OUT):
    seen |= {v[0] for v in map(valid, open(OUT, encoding='utf-8')) if v}
examples = [l.strip() for f in sorted(os.listdir(f'{HERE}/{LANG}-batches')) if f.startswith('20')
            for l in open(f'{HERE}/{LANG}-batches/{f}', encoding='utf-8') if valid(l)][::20][:12]
have = sorted(' '.join(c['words']) for c in cards if c['lang'] == LANG)

PROMPT = f"""You write study cards for Korean speakers learning {NAMES[LANG]}.
Write {{n}} NEW natural, everyday {NAMES[LANG]} sentences that native speakers really say.
One card per line, exactly 9 fields separated by "|", nothing else (no numbering, no code fences):
level|category|tab|chunks|Korean translation|key part inside the Korean translation|key meaning (Korean)|key meaning (English)|Korean meanings of the NON-key chunks, in order, separated by ";"
- level: 초 (short, basic), 중 (everyday, medium), 고 (longer, natural complex sentences). Mix about 25% 초, 45% 중, 30% 고.
- category: one of {' '.join(CATS)}. tab: empty, or 슬랭 / 연애 / 드라마·영화 (rarely).
- chunks: split the sentence into 2-4 meaningful chunks with "/". Mark the ONE key expression chunk (an idiom, phrasal pattern or useful phrase worth learning) with a leading "*". Put "*" only at the very start of a chunk, never after ¿ or ¡.
- Do NOT always put the key first: put it in the middle or at the end in most cards.
- The last field must have exactly as many items as there are chunks without "*".
- The key part (field 6) must appear word-for-word inside the Korean translation (field 5).
- Korean must sound natural and casual like a real Korean speaker, not a word-for-word translation.
- Vary topics: home, family, work, school, travel, food, health, money, feelings, dating, hobbies, weather.

Good examples:
{chr(10).join(examples)}

Do NOT repeat or closely paraphrase any of these existing sentences:
{chr(10).join(have)}
"""

# 키 받기 전에 대략 비용부터 보여 줘요 (입력은 기존 문장 목록 때문에 큼)
calls = -(-COUNT // PER) + 1
est_in = len(PROMPT) // 3 * calls
print(f'{NAMES[LANG]} 새 문장 {COUNT}개 · 호출 약 {calls}번 · 입력 약 {est_in:,} 토큰 예상')
KEY = (os.environ.get('GEMINI_API_KEY') or getpass.getpass('Gemini API 키 (안 보여요, 엔터만 치면 취소): ')).strip()
if not KEY: sys.exit('취소했어요')
if not KEY.isascii(): sys.exit('키에 한글이 섞였어요. 영문 입력으로 바꾸고 다시 붙여 넣어 주세요.')
API = 'https://generativelanguage.googleapis.com/v1beta/models'


def get(url, body=None):
    req = urllib.request.Request(url, json.dumps(body).encode() if body else None,
                                 {'Content-Type': 'application/json', 'x-goog-api-key': KEY})
    try: return json.load(urllib.request.urlopen(req, timeout=300))
    except urllib.error.HTTPError as e: sys.exit(f'실패 {e.code}: {e.read().decode()[:300]}')


MODEL = arg('--model', '')
if not MODEL:  # 글 쓰는 flash 모델 중 가장 최신 것을 골라요 (음성·이미지 전용은 빼고)
    names = [m['name'].split('/')[-1] for m in get(API + '?pageSize=200').get('models', [])
             if 'generateContent' in m.get('supportedGenerationMethods', [])]
    flash = [n for n in names if re.fullmatch(r'gemini-[\d.]+-flash', n)]
    if not flash: sys.exit('쓸 수 있는 flash 모델을 못 찾았어요: ' + ', '.join(names))
    MODEL = max(flash, key=lambda n: [float(x) for x in re.findall(r'[\d.]+', n)[0].split('.') if x])
print('모델:', MODEL)

added, used, tries = 0, {'in': 0, 'out': 0}, 0
with open(OUT, 'a', encoding='utf-8') as out:
    if os.path.getsize(OUT) == 0: out.write(f'# Gemini {MODEL} 초안 (검사 전)\n')
    while added < COUNT and tries < calls + 3:
        tries += 1
        n = min(PER, COUNT - added)
        res = get(f'{API}/{MODEL}:generateContent', {'contents': [{'parts': [{'text': PROMPT.format(n=n)}]}],
                                                      'generationConfig': {'temperature': 0.9}})
        u = res.get('usageMetadata', {})
        used['in'] += u.get('promptTokenCount', 0)
        used['out'] += u.get('candidatesTokenCount', 0) + u.get('thoughtsTokenCount', 0)
        try: text = ''.join(p.get('text', '') for p in res['candidates'][0]['content']['parts'])
        except (KeyError, IndexError): print('빈 응답, 다시 시도'); continue
        good = bad = 0
        for line in text.splitlines():
            if '|' not in line: continue
            v = valid(line)
            if not v:  # 왜 틀렸는지 볼 수 있게 따로 모아요
                bad += 1; open(OUT.replace('.txt', '.rejected'), 'a', encoding='utf-8').write(line + '\n'); continue
            if v[0] in seen: continue
            seen.add(v[0]); out.write(v[1] + '\n'); good += 1; added += 1
            if added >= COUNT: break
        out.flush()
        print(f'{tries}번째 호출: 좋은 줄 {good} · 형식 틀려서 버림 {bad} · 누적 {added}/{COUNT}')

print(f'\n끝: {added}개 → {os.path.relpath(OUT, HERE)}')
print(f'토큰: 입력 {used["in"]:,} · 출력(생각 포함) {used["out"]:,}')
print(f'검사: python3 en_build.py --lang {LANG}')
