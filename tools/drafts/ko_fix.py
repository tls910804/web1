"""이미 들어간 한국어 카드의 조각 나누기·핵심 표현을 고쳐요. 문장 글자는 절대 바뀌지 않게 검사해요.

고칠 줄(ko-fix/*.txt): id|조각/*핵심/조각|핵심 표현 영어 뜻|핵심 아닌 조각 영어 뜻(;로 구분, 순서대로)
사용: python3 ko_fix.py --dump 66 200   → ko66~ko200을 id|문장|번역 으로 보여 줘요
      python3 ko_fix.py                → 검사만
      python3 ko_fix.py --apply        → 검사 통과하면 cards.json·gloss.json에 반영
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = HERE + '/../../shorts-react/src/data'
lines = open(DATA + '/cards.json', encoding='utf-8').read().rstrip().split('\n')
cards = json.loads('\n'.join(lines))
byid = {c['id']: c for c in cards}
gloss = json.load(open(DATA + '/gloss.json'))
flat = lambda ws: ''.join(ws).replace(' ', '')

if '--dump' in sys.argv:
    a, b = (int(x) for x in sys.argv[sys.argv.index('--dump') + 1:][:2])
    for i in range(a, b + 1):
        c = byid.get(f'ko{i}')
        # 핵심이 이미 끝에 있고 조각이 둘 이상이면 고칠 필요 없어서 빼요
        if c and not (len(c['words']) > 1 and c['key'][-1] == len(c['words']) - 1) and ' ' in ' '.join(c['words']).strip():
            print(f"{c['id']}|{'/'.join(('*' if i in c['key'] else '') + w for i, w in enumerate(c['words']))}")
    sys.exit()

fix, errs, warns = {}, [], []
for path in sorted(glob.glob(HERE + '/ko-fix/*.txt')):
    for ln, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'): continue
        where = f'{os.path.basename(path)}:{ln}'
        p = [x.strip() for x in line.split('|')]
        if len(p) == 3: p.append('')
        if len(p) != 4: errs.append(f'{where} 칸 수 {len(p)}'); continue
        cid, chunks, mean, gl = p
        c = byid.get(cid)
        if not c: errs.append(f'{where} 없는 id {cid}'); continue
        parts = [x.strip() for x in chunks.split('/') if x.strip()]
        key = [i for i, x in enumerate(parts) if x.startswith('*')]
        words = [x.lstrip('*') for x in parts]
        if flat(words) != flat(c['words']): errs.append(f'{where} 문장이 달라요: {" ".join(words)} ≠ {" ".join(c["words"])}'); continue
        if not key or key != list(range(key[0], key[-1] + 1)): errs.append(f'{where} 핵심 표시(*) 오류'); continue
        g = [x.strip() for x in gl.split(';')] if gl else []
        if len(g) != len(words) - len(key): errs.append(f'{where} 단어 뜻 {len(g)}개, 핵심 아닌 조각 {len(words) - len(key)}개'); continue
        if len(words) == len(key) and len(words) > 1: warns.append(f'{where} 전부 핵심: {chunks}')
        fix[cid] = (words, key, mean, g)

from collections import Counter
pos = Counter('한 조각' if len(w) == 1 else '맨앞' if k[0] == 0 else '맨뒤' if k[-1] == len(w) - 1 else '가운데' for w, k, _, _ in fix.values())
print(f'고칠 카드 {len(fix)}개 · 핵심 위치 {dict(pos)}')
for e in errs: print('오류', e)
for w in warns[:30]: print('주의', w)
if '--apply' in sys.argv:
    if errs: sys.exit('오류가 있어서 반영하지 않았어요')
    out = []
    for line in lines:
        m = re.search(r'"id":"(ko\d+)"', line)
        if m and m.group(1) in fix:
            words, key, mean, g = fix[m.group(1)]
            c = byid[m.group(1)]
            c.update(words=words, key=key, expr=re.sub(r'[.,!?~…]+$', '', ' '.join(words[i] for i in key)), mean={'en': mean})
            it = iter(g)
            gloss[c['id']] = ['' if i in key else '|' + next(it) for i in range(len(words))]
            line = json.dumps(c, ensure_ascii=False, separators=(',', ':')) + line[len(line.rstrip(',]')):]  # 줄 끝 , 또는 ] 유지
            if not line.startswith('[') and out == []: line = '[' + line
        out.append(line)
    text = '\n'.join(out) + '\n'
    json.loads(text)
    open(DATA + '/cards.json', 'w', encoding='utf-8').write(text)
    json.dump(gloss, open(DATA + '/gloss.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('반영했어요')
