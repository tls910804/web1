"""Gemini로 언어별 5개씩(총 20개) 원문을 한국어로 번역해 표로 보여줘요. 앱 데이터는 건드리지 않아요.
실행: python3 tools/translate/ko20.py  (키는 화면에 안 보여요)
"""
import getpass, json, os, sys, urllib.request, urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import compare as m  # 카드 고르기와 모델 찾기 재사용

per, picked = {}, []
for c in m.pick():
    per[c['lang']] = per.get(c['lang'], 0) + 1
    if per[c['lang']] <= 5:
        picked.append(c)

key = getpass.getpass('Gemini API 키 (안 보여요): ').strip()
if not key.isascii():
    sys.exit('키에 한글이 섞였어요. 영문으로 다시 넣어 주세요.')

model = m.gemini_model(key)
print('모델:', model)
prompt = ('Translate each sentence into natural Korean (존댓말 as natural speech). '
          'Return ONLY a JSON array of strings, same order, one Korean translation per sentence.\n'
          + json.dumps([c['sentence'] for c in picked], ensure_ascii=False))
try:
    r = m.post(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
               {'contents': [{'parts': [{'text': prompt}]}], 'generationConfig': {'responseMimeType': 'application/json'}},
               {'x-goog-api-key': key})
except SystemExit:
    raise
out = m.parse(r['candidates'][0]['content']['parts'][0]['text'])
names = {'ja': '일본어', 'zh': '중국어', 'es': '스페인어', 'id': '인도네시아어'}
print('| 언어 | 원문 | Gemini 한국어 번역 |')
print('|---|---|---|')
for c, ko in zip(picked, out):
    print(f"| {names[c['lang']]} | {c['sentence']} | {ko} |")
