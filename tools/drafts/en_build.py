"""영어 문장 초안(en-batches/*.txt)을 앱 카드로 바꾸고 검사해요. (한국인이 배우는 영어)

초안 한 줄: 난이도|cat|tab|조각/*핵심/조각|한국어 번역|번역 속 핵심 부분|핵심 뜻(한)|핵심 뜻(영)|핵심 아닌 조각들의 한국어 뜻(;로 구분, 순서대로)
  난이도: 초/중/고 · tab은 슬랭·연애·드라마·영화만 · 핵심 조각 앞에 *(붙어 있으면 여러 개)
  핵심은 진짜 배울 표현(관용구·구동사·패턴)에 붙여요. 문장 맨 앞에 몰리지 않게.
사용: python3 en_build.py [--lang ja]   → 검사만 · --merge → 검사 통과하면 합쳐요
  다른 언어는 {lang}-batches/ 폴더를 읽어요. 일본어·중국어는 띄어쓰기 없이 글자 수로 난이도를 봐요.
"""
import glob, json, os, re, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = HERE + '/../../shorts-react/src/data'
LV = {'초': '초급', '중': '중급', '고': '고급'}
LANG = sys.argv[sys.argv.index('--lang') + 1] if '--lang' in sys.argv else 'en'
NO_SPACE = LANG in ('ja', 'zh')
# 난이도별 길이: 띄어 쓰는 언어는 단어 수, 일본어·중국어는 글자 수
LEN = {'초급': (2, 10), '중급': (6, 18), '고급': (12, 45)} if NO_SPACE else {'초급': (2, 7), '중급': (5, 11), '고급': (9, 24)}

cards = json.load(open(DATA + '/cards.json'))
gloss = json.load(open(DATA + '/gloss.json'))
norm = lambda s: re.sub(r'[\W_]+', '', s.lower())
seen = {norm(' '.join(c['words'])) for c in cards if c['lang'] == LANG}
n = max(int(c['id'][2:]) for c in cards if c['lang'] == LANG and re.fullmatch(LANG + r'\d+', c['id']))

new, new_gloss, errs, warns = [], {}, [], []
for path in sorted(glob.glob(HERE + f'/{LANG}-batches/*.txt')):
    for ln, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'): continue
        where = f'{os.path.basename(path)}:{ln}'
        p = [x.strip() for x in line.split('|')]
        if len(p) == 8: p.append('')
        if len(p) != 9: errs.append(f'{where} 칸 수 {len(p)}개 (9개): {line}'); continue
        lv, cat, tab, chunks, tr, trkey, mko, men, gl = p
        if lv not in LV: errs.append(f'{where} 난이도 {lv}'); continue
        parts = [x.strip() for x in chunks.split('/') if x.strip()]
        key = [i for i, x in enumerate(parts) if x.startswith('*')]
        words = [x.lstrip('*') for x in parts]
        if not key or key != list(range(key[0], key[-1] + 1)): errs.append(f'{where} 핵심 표시(*) 오류'); continue
        g = [x.strip() for x in gl.split(';')] if gl else []
        if len(g) != len(words) - len(key): errs.append(f'{where} 단어 뜻 {len(g)}개, 핵심 아닌 조각 {len(words) - len(key)}개'); continue
        if trkey and trkey not in tr: warns.append(f'{where} 번역 속 핵심 "{trkey}" 표시는 빼요(번역에 없음)'); trkey = ''
        k = norm(' '.join(words))
        if k in seen: warns.append(f'{where} 이미 있는 문장: {" ".join(words)}'); continue
        seen.add(k)
        nw = len(re.sub(r'[\s\W]', '', ''.join(words))) if NO_SPACE else len(' '.join(words).split())
        while lv != '초' and nw < LEN[LV[lv]][0]: lv = {'중': '초', '고': '중'}[lv]
        lo, hi = LEN[LV[lv]]
        if not lo <= nw <= hi: warns.append(f'{where} {LV[lv]} {nw}단어 (기준 {lo}~{hi}): {" ".join(words)}')
        n += 1
        cid = f'{LANG}{n}'
        card = {'id': cid, 'lang': LANG, 'cat': cat}
        if tab: card['tab'] = tab
        card.update({'words': words, 'key': key, 'expr': re.sub(r'[.,!?。、！？¡¿ ]+$', '', ('' if NO_SPACE else ' ').join(words[i] for i in key)),
                     'tr': {'ko': tr}, 'mean': {'ko': mko, 'en': men}, 'level': LV[lv]})
        if trkey: card['trKey'] = {'ko': trkey}
        new.append(card)
        it = iter(g)
        new_gloss[cid] = ['' if i in key else next(it) + '|' for i in range(len(words))]

pos = Counter('한 조각' if len(c['words']) == 1 else '맨앞' if c['key'][0] == 0 else '맨뒤' if c['key'][-1] == len(c['words']) - 1 else '가운데' for c in new)
print(f'새 카드 {len(new)}개 · {LANG} 전체 {sum(c["lang"] == LANG for c in cards) + len(new)}개')
print('난이도', dict(Counter(c['level'] for c in new)), '· 핵심 위치', dict(pos))
print('분류', dict(Counter(c.get('tab') or c['cat'] for c in new)))
for e in errs: print('오류', e)
for w in warns[:40]: print('주의', w)
if '--merge' in sys.argv:
    if errs: sys.exit('오류가 있어서 합치지 않았어요')
    text = open(DATA + '/cards.json', encoding='utf-8').read().rstrip()
    assert text.endswith(']')
    add = ''.join(',\n' + json.dumps(c, ensure_ascii=False, separators=(',', ':')) for c in new)
    open(DATA + '/cards.json', 'w', encoding='utf-8').write(text[:-1] + add + ']\n')
    gloss.update(new_gloss)
    json.dump(gloss, open(DATA + '/gloss.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.load(open(DATA + '/cards.json'))
    print('합쳤어요')
