"""단어장(words.json)의 단어와 예문 음성을 Edge TTS로 만들어 manifest에 더해요. 이미 있는 음성은 건드리지 않아요.

사용: python3 tools/audio/gen_words.py [--limit 3]
  느리게 듣기는 앱이 재생 속도(0.8×, 0.6×)로 처리해서 느린 파일은 만들지 않아요.
  비공식 서비스라 갑자기 막힐 수 있고, 앱을 공개·수익화하면 약관 위험이 있어요 (gen_edge.py와 같음).
  --limit N: 언어마다 N개만 tools/audio/sample/에 만들어 들어 봐요 (앱 파일은 그대로).
"""
import asyncio, hashlib, json, os, subprocess, sys
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(HERE + '/../../shorts-react')
LIMIT = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else None
OUT = HERE + '/sample' if LIMIT else ROOT + '/public/audio'
VOICES = {'en': 'en-US-AriaNeural', 'ko': 'ko-KR-SunHiNeural'}  # gen_edge.py와 같은 목소리

def fid(lang, text): return hashlib.sha1(f'{lang}|{text}'.encode()).hexdigest()[:12]

async def main():
    os.makedirs(OUT, exist_ok=True)
    mpath = ROOT + '/public/audio/manifest.json'
    manifest = json.load(open(mpath))
    book = json.load(open(ROOT + '/src/data/words.json'))
    jobs = []
    for lang, rows in book.items():
        texts = [t for w in rows for t in (w[0], w[2])]
        new = [t for t in dict.fromkeys(texts) if f'{lang}|{t}' not in manifest]
        jobs += [(lang, t) for t in (new[:LIMIT] if LIMIT else new)]
    print('만들 음성', len(jobs), '개', flush=True)
    made = 0
    for i, (lang, text) in enumerate(jobs, 1):
        h = fid(lang, text)
        m4a = f'{OUT}/{h}.m4a'
        if not os.path.exists(m4a):
            try:
                mp3 = m4a + '.mp3'
                await edge_tts.Communicate(text, VOICES[lang]).save(mp3)
                subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1', mp3, m4a], check=True, capture_output=True)
                os.remove(mp3)
            except Exception as e:
                # 막히면 바로 멈춰요. 다시 실행하면 이미 만든 파일은 건너뛰어요
                print('실패, 멈춤:', lang, text, repr(e)[:120])
                break
        manifest[f'{lang}|{text}'] = {'f': h}
        made += 1
        if i % 50 == 0: print(i, '/', len(jobs), flush=True)
    if LIMIT: print('테스트:', OUT, '에서 들어 보세요'); return
    json.dump(manifest, open(mpath, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('manifest에 더함', made, '/', len(jobs))

asyncio.run(main())
