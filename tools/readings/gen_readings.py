"""일본어·중국어 카드의 빈칸 정답 읽기를 만들어요 (앱에서 히라가나·병음으로 써도 정답 처리용).

사용: (pykakasi, pypinyin가 있는 파이썬으로) python gen_readings.py
결과: shorts-react/src/data/readings.json  {카드 id: 읽기}
  일본어: 히라가나 (카드 expr에 적힌 읽기가 있으면 그걸 먼저)
  중국어: 성조 없는 병음, 띄어쓰기 없이
자동 변환이라 드물게 틀릴 수 있어요 (특히 일본어 한자 읽기).
"""
import json, os, re
import pykakasi
from pypinyin import lazy_pinyin

ROOT = os.path.abspath(os.path.dirname(__file__) + '/../../shorts-react/src/data')
cards = json.load(open(ROOT + '/cards.json'))
kks = pykakasi.kakasi()
PUNCT = re.compile(r'[。、！？.,!?　 「」『』（）()…~〜]')
out = {}
for c in cards:
    if c['lang'] not in ('ja', 'zh') or not c['key']:
        continue
    ans = PUNCT.sub('', ''.join(c['words'][i] for i in c['key']))
    if not ans:
        continue
    m = re.match(r'^(.*?)\s*\(([^)]+)\)\s*$', c['expr'])
    if c['lang'] == 'ja':
        if m and PUNCT.sub('', m.group(1)) == ans:
            r = PUNCT.sub('', m.group(2))
        else:
            r = ''.join(x['hira'] for x in kks.convert(ans))
    else:
        r = ''.join(lazy_pinyin(ans)).lower()
    r = PUNCT.sub('', r)
    if r and r != ans:
        out[c['id']] = r
json.dump(out, open(ROOT + '/readings.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('읽기', len(out), '개')
