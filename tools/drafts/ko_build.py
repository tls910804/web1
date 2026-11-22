"""한국어 문장 초안(ko-batches/*.txt)을 앱 카드 형식으로 바꾸고 검사해요.

초안 한 줄: 난이도|cat|tab|조각/*핵심조각/조각|영어 번역|핵심 표현 영어 뜻|핵심 아닌 조각들의 영어 뜻(;로 구분, 순서대로)
  난이도: 초/중/고 · tab은 비워 두면 cat으로 정해져요(슬랭·연애·드라마·영화만 적어요) · 핵심 조각 앞에 * (붙어 있으면 여러 개 가능)
사용: python3 ko_build.py            → 검사만
      python3 ko_build.py --merge    → 검사 통과하면 cards.json·gloss.json 끝에 붙여요
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = HERE + '/../../shorts-react/src/data'
LV = {'초': '초급', '중': '중급', '고': '고급'}
# 띄어쓰기 뺀 글자 수 범위 (난이도별 문장 길이 기준)
LEN = {'초급': (3, 15), '중급': (7, 26), '고급': (16, 48)}

cards = json.load(open(DATA + '/cards.json'))
gloss = json.load(open(DATA + '/gloss.json'))
seen = {''.join(c['words']).replace(' ', '') for c in cards if c['lang'] == 'ko'}
seen_expr = {c['expr'] for c in cards if c['lang'] == 'ko'}
n = max(int(c['id'][2:]) for c in cards if c['lang'] == 'ko' and re.fullmatch(r'ko\d+', c['id']))

new, new_gloss, errs, warns = [], {}, [], []
for path in sorted(glob.glob(HERE + '/ko-batches/*.txt')):
    for ln, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'): continue
        where = f'{os.path.basename(path)}:{ln}'
        p = line.split('|')
        if len(p) == 6: p.append('')  # 조각이 하나뿐이면 단어 뜻 칸은 없어도 돼요
        if len(p) > 7: p = p[:6] + [';'.join(p[6:])]  # 단어 뜻을 | 로 나눠 적었어도 받아요
        if len(p) != 7: errs.append(f'{where} 칸 수 {len(p)}개 (7개여야 해요): {line}'); continue
        lv, cat, tab, chunks, tr, mean, gl = (x.strip() for x in p)
        if lv not in LV: errs.append(f'{where} 난이도 {lv}'); continue
        parts = [c.strip() for c in chunks.split('/') if c.strip()]
        key = [i for i, c in enumerate(parts) if c.startswith('*')]
        words = [c.lstrip('*') for c in parts]
        if not key: errs.append(f'{where} 핵심 조각(*)이 없어요'); continue
        if key != list(range(key[0], key[-1] + 1)): errs.append(f'{where} 핵심 조각이 떨어져 있어요'); continue
        g = [x.strip() for x in gl.split(';')] if gl else []
        if len(g) != len(words) - len(key): errs.append(f'{where} 단어 뜻 {len(g)}개, 핵심 아닌 조각 {len(words) - len(key)}개'); continue
        flat = ''.join(words).replace(' ', '')
        if flat in seen: warns.append(f'{where} 이미 있는 문장: {" ".join(words)}'); continue
        seen.add(flat)
        expr = re.sub(r'[.,!?~…]+$', '', ' '.join(words[i] for i in key))
        if expr in seen_expr: warns.append(f'{where} 핵심 표현 겹침(문장은 다름): {expr}')
        seen_expr.add(expr)
        # 난이도 기준보다 짧은 문장은 한 단계 낮춰요 (난이도별 길이가 섞이지 않게)
        while lv != '초' and len(flat) < LEN[LV[lv]][0]: lv = {'중': '초', '고': '중'}[lv]
        lo, hi = LEN[LV[lv]]
        if not lo <= len(flat) <= hi: warns.append(f'{where} {LV[lv]} 길이 {len(flat)}자 (기준 {lo}~{hi}): {" ".join(words)}')
        n += 1
        cid = f'ko{n}'
        card = {'id': cid, 'lang': 'ko', 'cat': cat}
        if tab: card['tab'] = tab
        card.update({'words': words, 'key': key, 'expr': expr, 'tr': {'en': tr}, 'mean': {'en': mean}, 'level': LV[lv]})
        new.append(card)
        it = iter(g)
        new_gloss[cid] = ['' if i in key else '|' + next(it) for i in range(len(words))]

from collections import Counter
print(f'새 카드 {len(new)}개 · 한국어 전체 {sum(c["lang"] == "ko" for c in cards) + len(new)}개')
print('난이도', dict(Counter(c['level'] for c in new)))
print('분류', dict(Counter(c.get('tab') or c['cat'] for c in new)))
for e in errs: print('오류', e)
for w in warns[:60]: print('주의', w)
if len(warns) > 60: print(f'주의 {len(warns) - 60}개 더')
if '--merge' in sys.argv:
    if errs: sys.exit('오류가 있어서 합치지 않았어요')
    # cards.json은 한 줄에 카드 하나 형식을 지켜요
    text = open(DATA + '/cards.json', encoding='utf-8').read().rstrip()
    assert text.endswith(']')
    add = ''.join(',\n' + json.dumps(c, ensure_ascii=False, separators=(',', ':')) for c in new)
    open(DATA + '/cards.json', 'w', encoding='utf-8').write(text[:-1] + add + ']\n')
    gloss.update(new_gloss)
    json.dump(gloss, open(DATA + '/gloss.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.load(open(DATA + '/cards.json'))
    print('합쳤어요')
