"""카드에 한 언어의 문장 뜻(tr)·강조 부분(trKey)·표현 뜻(mean)·단어 뜻(gloss)을 채워요.

실행:  python3 tools/translate/fill.py ja 100      (100개만 골고루 해 보고 토큰·값 확인)
       python3 tools/translate/fill.py ja          (키를 물어봐요. 번역해서 out_ja.json에만 저장)
       python3 tools/translate/fill.py id --apply  (키 없이, out_id.json을 앱 데이터에 반영)
       python3 tools/translate/fill.py --test      (자체 점검)
깨진 답·네트워크 끊김·서버 오류(5xx)는 알아서 다시 해요(연속 3번 실패하면 멈춤). 키 오류·한도 초과는 바로 멈춰요.
다시 실행하면 안 된 것만 이어서 해요.
"""
import getpass, http.client, json, os, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import compare as m  # 요청·응답 해석·모델 찾기 재사용

HERE = os.path.dirname(os.path.abspath(__file__))
CARDS = os.path.join(m.DATA, 'cards.json')
GLOSS = os.path.join(m.DATA, 'gloss.json')
BATCH = 25
# gloss 한 칸의 순서. shorts-react/src/lib/text.ts의 GLOSS_ORDER와 같아야 해요
ORDER = ['ko', 'en', 'id', 'ja', 'zh', 'es']
# 번역할 언어: (영어 이름, 채울 카드의 언어들)
TARGETS = {'en': ('English', ['ja', 'zh', 'es', 'id']), 'id': ('Indonesian', ['en', 'ko', 'ja', 'zh', 'es']),
           'ja': ('Japanese', ['en', 'ko', 'zh', 'es', 'id']),
           'zh': ('Simplified Chinese', ['en', 'ko', 'ja', 'es', 'id']),
           'es': ('Spanish', ['en', 'ko', 'ja', 'zh', 'id'])}

PROMPT = """You translate learning content for a language app into natural, simple {name} for {name}-speaking learners.
For each card you get: the sentence (in the language being learned: "lang"), the key phrase, reference translations
of the sentence and of the key phrase (Korean and/or English), and the sentence split into chunks with a reference
gloss for each chunk ("" means: no gloss needed for that chunk).
Return ONLY a JSON array, one object per card, same order:
{{"id": card id, "tr": {name} translation of the whole sentence (match how casual or polite the original is),
 "trKey": the exact substring of "tr" that corresponds to the key phrase ("" if there is none),
 "mean": short {name} meaning of the key phrase,
 "gloss": {name} gloss per chunk (same length as chunks; keep "" where the reference gloss is "")}}
Keep glosses short (dictionary style) and never use the "|" character.
Translate from the original sentence, using the references only as hints.

Cards:
"""


# 답의 모양을 정해 주면 깨진 JSON이 잘 안 나와요
_STR = {'type': 'STRING'}
SCHEMA = {'type': 'ARRAY', 'items': {'type': 'OBJECT', 'required': ['id', 'tr', 'trKey', 'mean', 'gloss'],
          'properties': {'id': _STR, 'tr': _STR, 'trKey': _STR, 'mean': _STR, 'gloss': {'type': 'ARRAY', 'items': _STR}}}}


def out_path(lang):
    return os.path.join(HERE, f'out_{lang}.json')


def refs(d):
    return {k: v for k, v in (d or {}).items() if k in ('ko', 'en')}


def spread(items, n):
    """앞쪽만 말고 골고루 n개"""
    return items[::max(1, len(items) // n)][:n]


def todo(cards, gloss, done, lang):
    out = []
    for c in cards:
        if c['lang'] not in TARGETS[lang][1] or c.get('tr', {}).get(lang) or c['id'] in done:
            continue
        g = [s.split('|') for s in gloss.get(c['id'], [])]
        out.append({
            'id': c['id'], 'lang': c['lang'], 'sentence': ('' if c['lang'] in ('ja', 'zh') else ' ').join(c['words']),
            'key': c.get('expr', ''), 'tr': refs(c.get('tr')), 'mean': refs(c.get('mean')),
            'chunks': [{'text': w, 'ref': next((p for p in g[i] if p), '') if i < len(g) else ''} for i, w in enumerate(c['words'])],
        })
    return out


def good(card, x):
    """쓸 수 있는 답만 골라요. 이상한 답은 버리고 다음 실행 때 다시 해요."""
    return (isinstance(x, dict) and x.get('id') == card['id'] and isinstance(x.get('tr'), str) and x['tr'].strip() != ''
            and isinstance(x.get('gloss'), list) and len(x['gloss']) == len(card['chunks'])
            and all(isinstance(s, str) and '|' not in s for s in x['gloss']))


def merge(card, glosses, x, lang):
    card.setdefault('tr', {})[lang] = x['tr']
    k = x.get('trKey')
    if isinstance(k, str) and k and k in x['tr']:
        card.setdefault('trKey', {})[lang] = k
    if isinstance(x.get('mean'), str) and x['mean'] and not card.get('mean', {}).get(lang):
        card.setdefault('mean', {})[lang] = x['mean']
    n, out = ORDER.index(lang), []
    for i, s in enumerate(glosses):
        # 빈 칸(핵심 표현)과 이미 채워진 칸은 그대로
        p = s.split('|')
        p += [''] * (n + 1 - len(p))
        if s and not p[n] and i < len(x['gloss']) and x['gloss'][i]:
            p[n] = x['gloss'][i]
            s = '|'.join(p)
        out.append(s)
    return out


def cards_text(cards):
    # 한 줄에 카드 하나
    return '[' + ',\n'.join(json.dumps(c, ensure_ascii=False, separators=(',', ':')) for c in cards) + ']\n'


def save(path, text):
    with open(path + '.tmp', 'w') as f:
        f.write(text)
    os.replace(path + '.tmp', path)


def retry(fn, tries=3, wait=15):
    """잠깐의 실패만 다시 해요. 마지막까지 안 되면 멈춰요."""
    for n in range(1, tries + 1):
        try:
            return fn()
        except (ValueError, KeyError, IndexError, TypeError, AttributeError, OSError, http.client.HTTPException) as e:
            err = f'{type(e).__name__}: {e}'
        except SystemExit as e:
            if not str(e).startswith('요청 실패 5'):
                raise
            err = str(e)
        if n < tries:
            print(f'  실패({err[:80]}), {wait}초 뒤 다시 해요 ({n}/{tries - 1})')
            time.sleep(wait)
    sys.exit(f'연속 {tries}번 실패해서 멈췄어요: {err[:200]}')


def apply(lang):
    cards, gloss, done = json.load(open(CARDS)), json.load(open(GLOSS)), json.load(open(out_path(lang)))
    n = 0
    for c in cards:
        if c['id'] in done:  # 여러 번 해도 결과가 같아요
            g = merge(c, gloss.get(c['id'], []), done[c['id']], lang)
            if c['id'] in gloss:
                gloss[c['id']] = g
            n += 1
    save(CARDS, cards_text(cards))
    save(GLOSS, json.dumps(gloss, ensure_ascii=False, separators=(',', ':')))
    print(f'카드 {n}개에 반영했어요.')


def test():
    c = {'id': 'x', 'tr': {'ko': '가'}, 'mean': {'en': 'a'}}
    x = {'id': 'x', 'tr': 'Aku jalan.', 'trKey': 'jalan', 'mean': 'berjalan', 'gloss': ['aku', '', 'ya']}
    assert good({'id': 'x', 'chunks': [1, 2, 3]}, x) and not good({'id': 'x', 'chunks': [1]}, x)
    assert merge(c, ['나|I', '', '|yes'], x, 'id') == ['나|I|aku', '', '|yes|ya']
    assert merge(c, ['지금|', '', '요|x|y'], x, 'id') == ['지금||aku', '', '요|x|y']
    assert c['tr']['id'] == 'Aku jalan.' and c['trKey'] == {'id': 'jalan'} and c['mean'] == {'en': 'a', 'id': 'berjalan'}
    assert merge(c, ['나|'], x, 'en') == ['나|aku']
    left = [ValueError('x'), SystemExit('요청 실패 503: x')]
    def flaky():
        if left:
            raise left.pop(0)
        return 1
    assert retry(flaky, wait=0) == 1
    left = [SystemExit('요청 실패 429: x')]
    try:
        retry(flaky, wait=0)
        raise AssertionError('한도 초과는 멈춰야 해요')
    except SystemExit as e:
        assert '429' in str(e)
    assert refs({'ko': 1, 'en': 2, 'id': 3}) == {'ko': 1, 'en': 2} and spread(list(range(10)), 3) == [0, 3, 6]
    assert merge({}, ['나|I'], {'tr': 't', 'gloss': ['私']}, 'ja') == ['나|I||私']
    print('ok fill')


def run(lang, limit=0):
    path = out_path(lang)
    done = json.load(open(path)) if os.path.exists(path) else {}
    rest = todo(json.load(open(CARDS)), json.load(open(GLOSS)), done, lang)
    if not rest:
        sys.exit('번역할 카드가 없어요. --apply 로 반영하세요.')
    left = len(rest)
    if limit:
        rest = spread(rest, limit)
    print(f'남은 카드 {left}개 중 {len(rest)}개를 해요. 멈추려면 Ctrl+C')
    used = {'in': 0, 'out': 0, 'think': 0, 'cards': 0}
    key = getpass.getpass('Gemini API 키 (안 보여요): ').strip()
    if not key or not key.isascii():
        sys.exit('키가 비었거나 한글이 섞였어요.')
    model = retry(lambda: m.gemini_model(key))
    print('모델:', model)
    prompt = PROMPT.format(name=TARGETS[lang][0])
    for i in range(0, len(rest), BATCH):
        batch = rest[i:i + BATCH]

        def ask():
            r = m.post(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
                       {'contents': [{'parts': [{'text': prompt + json.dumps(batch, ensure_ascii=False)}]}],
                        'generationConfig': {'responseMimeType': 'application/json', 'responseSchema': SCHEMA,
                                             'thinkingConfig': {'thinkingLevel': 'low'}}}, {'x-goog-api-key': key})
            u = r.get('usageMetadata', {})  # 실패해서 버린 답도 값은 나가니까 먼저 더해요
            used['in'] += u.get('promptTokenCount', 0)
            used['out'] += u.get('candidatesTokenCount', 0)
            used['think'] += u.get('thoughtsTokenCount', 0)
            got = {x.get('id'): x for x in m.parse(r['candidates'][0]['content']['parts'][0]['text']) if isinstance(x, dict)}
            ok = {c['id']: got[c['id']] for c in batch if good(c, got.get(c['id']))}
            if not ok:
                raise ValueError('쓸 수 있는 답이 없어요')
            return ok

        ok = retry(ask)
        used['cards'] += len(batch)
        done.update(ok)
        save(path, json.dumps(done, ensure_ascii=False, indent=1))
        # shortcut: 단가는 compare.py의 대략값. 정확한 금액은 Google 결제 화면에서
        pin, pout = m.PRICE['gemini']
        cost = used['in'] / 1e6 * pin + (used['out'] + used['think']) / 1e6 * pout
        print(f'  {min(i + BATCH, len(rest))}/{len(rest)} (버린 답 {len(batch) - len(ok)}개) '
              f'토큰: 보냄 {used["in"]:,} 받음 {used["out"]:,} 생각 {used["think"]:,} · 약 ${cost:.2f}')
    per = cost / used['cards']
    print(f'카드 1개당 약 ${per:.5f} → 남은 {left - len(rest)}개면 약 ${per * (left - len(rest)):.2f}')
    print('끝!' + ('' if limit else f' 이제: python3 tools/translate/fill.py {lang} --apply'))


if __name__ == '__main__':
    args = sys.argv[1:]
    if args == ['--test']:
        test()
    elif args and args[0] in TARGETS:
        apply(args[0]) if '--apply' in args else run(args[0], int(args[1]) if len(args) > 1 else 0)
    else:
        sys.exit(__doc__)
