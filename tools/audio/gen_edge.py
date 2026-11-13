"""Edge TTS(Microsoft 신경망 음성, 무료·가입 없음)로 음성 파일 만들기. gen.py와 같은 파일 이름·manifest 형식이에요.

사용: python3 gen_edge.py [--limit 2]
  pip install edge-tts 가 필요해요. 비공식 서비스라 갑자기 막힐 수 있고, 앱을 공개·수익화하면 약관 위험이 있어요.
  --limit N은 테스트용이에요: 언어마다 문장 N개만 tools/audio/sample/에 만들어요(앱 파일은 건드리지 않아요).
  끊겨도 다시 실행하면 .edge_done.json 기록을 보고 이어서 만들어요.
"""
import asyncio, hashlib, json, os, re, shutil, subprocess, sys
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(HERE + '/../../shorts-react')
LIMIT = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else None
OUT = HERE + '/sample' if LIMIT else ROOT + '/public/audio'
NO_SPACE = {'ja', 'zh'}
VOICES = {
    'en': 'en-US-AriaNeural', 'ko': 'ko-KR-SunHiNeural', 'ja': 'ja-JP-NanamiNeural', 'zh': 'zh-CN-XiaoxiaoNeural',
    'es': 'es-ES-ElviraNeural', 'fr': 'fr-FR-DeniseNeural', 'de': 'de-DE-KatjaNeural', 'pt': 'pt-BR-FranciscaNeural',
    'ru': 'ru-RU-SvetlanaNeural', 'vi': 'vi-VN-HoaiMyNeural', 'id': 'id-ID-GadisNeural',
}
SLOW = {'vi': '-10%'}  # 베트남어 음성은 -10%보다 느린 속도를 받지 않아요(NoAudioReceived)
cards = json.load(open(ROOT + '/src/data/cards.json'))
# 쇼츠 문장도 같은 목소리로 (videos.json + feed.ts 안의 첫 영상 카드)
cards += json.load(open(ROOT + '/src/data/videos.json'))
import ast
_feed = open(ROOT + '/src/lib/feed.ts').read()
_vc = _feed[_feed.index('const VIDEO_CARD'):]
cards.append({'lang': re.search(r"lang: '(\w+)'", _vc).group(1), 'words': ast.literal_eval(re.search(r'words: (\[.*?\]),', _vc).group(1)), 'expr': re.search(r"expr: '([^']*)'", _vc).group(1)})
os.makedirs(OUT, exist_ok=True)
DONE = HERE + '/.edge_done.json'
done = set(json.load(open(DONE))) if os.path.exists(DONE) and not LIMIT else set()

def clean(w): return re.sub(r'^[¡¿\s]+|[.,!?。、！？\s]+$', '', w)
def fid(lang, text): return hashlib.sha1(f'{lang}|{text}'.encode()).hexdigest()[:12]

jobs = {}  # (lang,text) -> 문장이면 True (느린 버전도 만든다)
for c in cards:
    l = c['lang']
    jobs[(l, ('' if l in NO_SPACE else ' ').join(c['words']))] = True
    if c['expr']: jobs.setdefault((l, re.sub(r'\s*\(.*\)$', '', c['expr'])), False)
    for w in c['words']:
        t = clean(w)
        if t: jobs.setdefault((l, t), False)

async def tts(text, lang, rate, m4a):
    mp3 = m4a + '.mp3'
    await edge_tts.Communicate(text, VOICES[lang], rate=rate).save(mp3)
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1', mp3, m4a], check=True, capture_output=True)
    os.remove(mp3)

async def main():
    # 기존 manifest(AI 전화 음성 등)는 지우지 않고 더한다
    manifest = json.load(open(OUT + '/manifest.json')) if not LIMIT and os.path.exists(OUT + '/manifest.json') else {}
    seen, fails = {}, 0
    for i, ((l, text), sentence) in enumerate(sorted(jobs.items()), 1):
        if LIMIT:
            if not sentence: continue
            seen[l] = seen.get(l, 0) + 1
            if seen[l] > LIMIT: continue
        h = fid(l, text)
        entry = {'f': h}
        try:
            for suffix, rate in [('', '+0%')] + ([('.slow', SLOW.get(l, '-35%'))] if sentence else []):
                m4a = f'{OUT}/{h}{suffix}.m4a'
                if m4a not in done:
                    try:
                        await tts(text, l, rate, m4a)
                    except Exception:
                        if not suffix: raise
                        # shortcut: 이 음성이 느린 속도를 거부하면 보통 속도 파일을 그대로 쓴다(베트남어 일부 문장)
                        shutil.copyfile(f'{OUT}/{h}.m4a', m4a)
                    done.add(m4a)
            if sentence: entry['s'] = 1
            manifest[f'{l}|{text}'] = entry
        except Exception as e:
            fails += 1
            print('FAIL', l, text, repr(e)[:100])
        if i % 50 == 0:
            print(i, '/', len(jobs), flush=True)
            if not LIMIT: json.dump(sorted(done), open(DONE, 'w'))
    if LIMIT: print('테스트 모드:', OUT, '에서 들어 보세요'); return
    json.dump(sorted(done), open(DONE, 'w'))
    if fails: print(f'실패 {fails}개: 다시 실행하면 이어서 만들어요. manifest는 쓰지 않았어요.'); return
    json.dump(manifest, open(OUT + '/manifest.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print('manifest', len(manifest), '/', len(jobs))

asyncio.run(main())
