"""영어 뜻 시험: 영어 뜻이 없는 카드 100개(일본어·중국어·스페인어·인도네시아어 25개씩)를
Gemini Flash와 Claude Sonnet으로 각각 번역해서 비교표(compare.html)를 만들어요. 앱 데이터는 건드리지 않아요.

실행: python3 tools/translate/compare.py   (키는 실행하면 물어봐요. 화면에 안 보여요. 엔터만 누르면 그 모델은 건너뛰어요)
실패하면 바로 멈춰요(다시 시도 안 함).
"""
import getpass, html, json, os, re, sys, time, urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, 'shorts-react', 'src', 'data')
OUT = os.path.join(ROOT, 'tools', 'drafts', 'en-test')
LANGS = {'ja': '일본어', 'zh': '중국어', 'es': '스페인어', 'id': '인도네시아어'}
PER_LANG, BATCH = 25, 25
CLAUDE_MODEL = 'claude-sonnet-5-5'
# shortcut: 단가는 검색으로 찾은 대략값(달러/100만 토큰). 실제 청구 전에 공식 가격표로 다시 확인
PRICE = {'gemini': (1.5, 7.5), 'claude': (3.0, 15.0)}

PROMPT = """You translate learning content for a language app into natural, simple English for English-speaking learners.
For each card you get: the sentence (in the language being learned), the key phrase, a Korean reference translation,
and the sentence split into chunks with a Korean gloss for each chunk ("" means: no gloss needed for that chunk).
Return ONLY a JSON array, one object per card, same order:
{"id": card id, "tr": English translation of the whole sentence, "mean": short English meaning of the key phrase,
 "gloss": English gloss per chunk (same length as chunks; keep "" where the Korean gloss is "")}
Keep glosses short (dictionary style, e.g. "to go", "please give me"). Translate from the original sentence, using the Korean only as a hint.

Cards:
"""


def pick():
    cards = json.load(open(os.path.join(DATA, 'cards.json')))
    gloss = json.load(open(os.path.join(DATA, 'gloss.json')))
    out = []
    for code in LANGS:
        pool = [c for c in cards if c['lang'] == code and not c.get('tr', {}).get('en')]
        step = max(1, len(pool) // PER_LANG)  # 앞쪽만 말고 골고루
        for c in pool[::step][:PER_LANG]:
            g = gloss.get(c['id'], [])
            out.append({
                'id': c['id'], 'lang': code, 'sentence': ' '.join(c['words']) if code not in ('ja', 'zh') else ''.join(c['words']),
                'key': c.get('expr', ''), 'ko': c.get('tr', {}).get('ko', ''), 'ko_mean': c.get('mean', {}).get('ko', ''),
                'chunks': [{'text': w, 'ko': (g[i].split('|')[0] if i < len(g) and g[i] else '')} for i, w in enumerate(c['words'])],
            })
    return out


def post(url, body, headers):
    req = urllib.request.Request(url, json.dumps(body).encode(), {'Content-Type': 'application/json', **headers})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f'요청 실패 {e.code}: {e.read().decode()[:400]}')


def parse(text):
    text = text.strip()
    if text.startswith('```'):
        text = text.split('\n', 1)[1].rsplit('```', 1)[0]
    return json.loads(text)


def gemini_model(key):
    r = urllib.request.urlopen(urllib.request.Request(
        'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', headers={'x-goog-api-key': key}), timeout=60)
    names = [m['name'].split('/')[-1] for m in json.load(r)['models'] if 'generateContent' in m.get('supportedGenerationMethods', [])]
    if os.environ.get('GEMINI_MODEL'):
        return os.environ['GEMINI_MODEL']
    # 일반 글 모델만: gemini-3.6-flash 같은 이름 (omni·tts·lite 등은 빼요)
    flash = [n for n in names if re.fullmatch(r'gemini-\d+(\.\d+)?-flash', n)]
    if not flash:
        sys.exit(f'Flash 모델을 못 찾았어요: {names[:30]}')
    return sorted(flash, key=lambda n: [(0, int(p), '') if p.isdigit() else (1, 0, p) for p in n.replace('-', '.').split('.')])[-1]


def run_gemini(key, batches):
    model = gemini_model(key)
    print('Gemini 모델:', model)
    res, tin, tout = [], 0, 0
    for i, b in enumerate(batches, 1):
        r = post(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
                 {'contents': [{'parts': [{'text': PROMPT + json.dumps(b, ensure_ascii=False)}]}],
                  'generationConfig': {'responseMimeType': 'application/json'}}, {'x-goog-api-key': key})
        u = r.get('usageMetadata', {})
        tin += u.get('promptTokenCount', 0); tout += u.get('candidatesTokenCount', 0) + u.get('thoughtsTokenCount', 0)
        res += parse(r['candidates'][0]['content']['parts'][0]['text'])
        print(f'  Gemini {i}/{len(batches)} 완료')
    return model, res, tin, tout


def run_claude(key, batches):
    res, tin, tout = [], 0, 0
    for i, b in enumerate(batches, 1):
        r = post('https://api.anthropic.com/v1/messages',
                 {'model': CLAUDE_MODEL, 'max_tokens': 8000, 'messages': [{'role': 'user', 'content': PROMPT + json.dumps(b, ensure_ascii=False)}]},
                 {'x-api-key': key, 'anthropic-version': '2023-06-01'})
        u = r.get('usage', {})
        tin += u.get('input_tokens', 0); tout += u.get('output_tokens', 0)
        res += parse(''.join(c.get('text', '') for c in r['content'] if c.get('type') == 'text'))
        print(f'  Claude {i}/{len(batches)} 완료')
    return CLAUDE_MODEL, res, tin, tout


def page(cards, runs):
    esc = html.escape
    by = {name: {x['id']: x for x in r[1]} for name, r in runs.items()}
    head = ''.join(f'<p><b>{esc(n)}</b> ({esc(r[0])}): 보낸 {r[2]:,} · 받은 {r[3]:,} 토큰 · 약 ${r[4]:.3f} '
                   f'→ 카드 6,000개면 약 ${r[4] * 60:.2f}</p>' for n, r in runs.items())
    rows = []
    for c in cards:
        cells = ''
        for n in runs:
            x = by[n].get(c['id'], {})
            gl = ' · '.join(f'{esc(ch["text"])}={esc(g)}' for ch, g in zip(c['chunks'], x.get('gloss', [])) if g)
            cells += f'<td><b>{esc(x.get("tr", "없음"))}</b><br><i>{esc(c["key"])}</i> = {esc(x.get("mean", ""))}<br><small>{gl}</small></td>'
        rows.append(f'<tr><td>{LANGS[c["lang"]]}</td><td>{esc(c["sentence"])}<br><small>{esc(c["ko"])} · {esc(c["key"])}={esc(c["ko_mean"])}</small></td>{cells}</tr>')
    th = ''.join(f'<th>{esc(n)}</th>' for n in runs)
    return (f'<!doctype html><meta charset=utf-8><title>영어 뜻 비교</title><style>body{{font-family:sans-serif;padding:16px;background:#faf9f6}}'
            f'table{{border-collapse:collapse}}td,th{{border:1px solid #ddd;padding:8px;vertical-align:top;font-size:14px}}small{{color:#666}}</style>'
            f'<h2>영어 뜻 비교 (카드 {len(cards)}개)</h2>{head}<table><tr><th>언어</th><th>원문 · 한국어 뜻</th>{th}</tr>{"".join(rows)}</table>')


def main():
    cards = pick()
    batches = [[{k: c[k] for k in ('id', 'sentence', 'key', 'ko', 'ko_mean', 'chunks')} for c in cards[i:i + BATCH]] for i in range(0, len(cards), BATCH)]
    print(f'카드 {len(cards)}개, {len(batches)}번에 나눠 보내요.')
    gk = getpass.getpass('Gemini API 키 (안 보여요, 건너뛰려면 엔터): ').strip()
    ck = getpass.getpass('Claude API 키 (안 보여요, 건너뛰려면 엔터): ').strip()
    if not (gk or ck):
        sys.exit('키를 하나도 안 넣었어요.')
    for k in (gk, ck):
        if k and not k.isascii():
            sys.exit('키에 한글이 섞였어요. 영문 입력으로 바꾸고 다시 붙여 넣어 주세요.')
    runs = {}
    for name, key, fn in (('Gemini', gk, run_gemini), ('Claude', ck, run_claude)):
        if not key:
            continue
        t = time.time()
        model, res, tin, tout = fn(key, batches)
        pin, pout = PRICE[name.lower()]
        runs[name] = (model, res, tin, tout, tin / 1e6 * pin + tout / 1e6 * pout)
        print(f'{name}: {time.time() - t:.0f}초, 보낸 {tin:,} · 받은 {tout:,} 토큰, 약 ${runs[name][4]:.3f}')
    os.makedirs(OUT, exist_ok=True)
    json.dump({n: r[1] for n, r in runs.items()}, open(os.path.join(OUT, 'results.json'), 'w'), ensure_ascii=False, indent=1)
    open(os.path.join(OUT, 'compare.html'), 'w').write(page(cards, runs))
    print('끝! 비교표:', os.path.join(OUT, 'compare.html'))


if __name__ == '__main__':
    main()
