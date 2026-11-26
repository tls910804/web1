"""문장 카드의 단어 조각(누르면 나오는 단어)과 핵심 표현 중 음성이 없는 것만 Edge TTS로 만들어 manifest에 더해요.
이미 있는 음성(Gemini 문장 등)은 절대 건드리지 않아요.

사용: python3 tools/audio/gen_chunks.py [--limit 3]
  --limit N: 언어마다 N개만 tools/audio/sample/에 만들어 들어 봐요 (앱 파일은 그대로).
  처음 실패하면 바로 멈춰요. 다시 실행하면 만든 것은 건너뛰고 이어서 해요.
"""
import asyncio, hashlib, json, os, re, subprocess, sys
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(HERE + '/../../shorts-react')
LIMIT = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else None
OUT = HERE + '/sample' if LIMIT else ROOT + '/public/audio'
MPATH = ROOT + '/public/audio/manifest.json'
VOICES = {  # gen_edge.py와 같은 목소리
    'en': 'en-US-AriaNeural', 'ko': 'ko-KR-SunHiNeural', 'ja': 'ja-JP-NanamiNeural', 'zh': 'zh-CN-XiaoxiaoNeural',
    'es': 'es-ES-ElviraNeural', 'fr': 'fr-FR-DeniseNeural', 'de': 'de-DE-KatjaNeural', 'pt': 'pt-BR-FranciscaNeural',
    'ru': 'ru-RU-SvetlanaNeural', 'vi': 'vi-VN-HoaiMyNeural', 'id': 'id-ID-GadisNeural',
}
WORKERS = 6

def clean(w): return re.sub(r'^[¡¿\s]+|[.,!?。、！？\s]+$', '', w)  # lib/text.ts의 clean과 같아야 해요
def fid(lang, text): return hashlib.sha1(f'{lang}|{text}'.encode()).hexdigest()[:12]

manifest = json.load(open(MPATH))
jobs, per = {}, {}
for c in json.load(open(ROOT + '/src/data/cards.json')):
    l = c['lang']
    for t in [clean(w) for w in c['words']] + [re.sub(r'\s*\(.*\)$', '', c['expr'])]:
        if not t or f'{l}|{t}' in manifest or (l, t) in jobs: continue
        if LIMIT and per.get(l, 0) >= LIMIT: continue
        per[l] = per.get(l, 0) + 1
        jobs[(l, t)] = 1
jobs = list(jobs)
os.makedirs(OUT, exist_ok=True)
print('만들 음성', len(jobs), '개', flush=True)

stop = False
fails = [0]
skipped = []
made = 0

async def one(l, t):
    global made
    m4a = f'{OUT}/{fid(l, t)}.m4a'
    if not os.path.exists(m4a):
        mp3 = m4a + '.mp3'
        try:
            await edge_tts.Communicate(t, VOICES[l]).save(mp3)
        except edge_tts.exceptions.NoAudioReceived:
            # 베트남어 짧은 조각 일부는 마침표가 있어야 읽어 줘요 ('tôi chán' 실패, 'Tôi chán.' 성공). 무료라 한 번만 더 해 봐요
            try:
                await edge_tts.Communicate(t + '.', VOICES[l]).save(mp3)
            except Exception:
                if os.path.exists(mp3): os.remove(mp3)  # 빈 임시 파일 남기지 않기
                raise
        await asyncio.to_thread(subprocess.run, ['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1', mp3, m4a], check=True, capture_output=True)
        os.remove(mp3)
    manifest[f'{l}|{t}'] = {'f': fid(l, t)}
    made += 1

def save():
    if not LIMIT: json.dump(manifest, open(MPATH, 'w'), ensure_ascii=False, separators=(',', ':'))

async def worker(q):
    global stop
    while not stop and not q.empty():
        l, t = q.get_nowait()
        try:
            await one(l, t)
            fails[0] = 0
        except Exception as e:
            # 몇몇 문장은 Edge가 음성을 안 줘요(NoAudioReceived) → 건너뛰어요. 연달아 실패하면 막힌 거라 멈춰요 (다시 시도 안 함)
            fails[0] += 1
            skipped.append(f'{l}|{t}')
            print('건너뜀:', l, t, repr(e)[:80], flush=True)
            if fails[0] >= 20:
                stop = True
                print('연달아 20번 실패, 멈춤', flush=True)
                return
            continue
        if made % 200 == 0: save(); print(made, '/', len(jobs), flush=True)

async def main():
    q = asyncio.Queue()
    for j in jobs: q.put_nowait(j)
    await asyncio.gather(*(worker(q) for _ in range(WORKERS)))
    save()
    if skipped: print('Edge가 거부해서 건너뛴 것', len(skipped), '개:', skipped[:20])
    print('끝:', made, '/', len(jobs), '(테스트: ' + OUT + ')' if LIMIT else '')

asyncio.run(main())
