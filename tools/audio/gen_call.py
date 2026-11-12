"""AI 전화 대사 음성을 Edge TTS(신경망 음성)로 만들어 public/audio에 넣고 manifest.json에 더한다.

사용: python3 gen_call.py   (pip install edge-tts 필요)
상황마다 data/calls.json의 voice로 읽어요. 이미 있는 파일은 건너뛰어요.
비공식 서비스라 갑자기 막힐 수 있고, 앱을 공개·수익화하면 약관 위험이 있어요(gen_edge.py와 같음).
"""
import asyncio, hashlib, json, os, subprocess
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(HERE + '/../../shorts-react')
OUT = ROOT + '/public/audio'
calls = json.load(open(ROOT + '/src/data/calls.json'))
MAN = OUT + '/manifest.json'
manifest = json.load(open(MAN))

def fid(lang, text): return hashlib.sha1(f'{lang}|{text}'.encode()).hexdigest()[:12]

async def tts(text, voice, rate, m4a):
    mp3 = m4a + '.mp3'
    await edge_tts.Communicate(text, voice, rate=rate).save(mp3)
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1', mp3, m4a], check=True, capture_output=True)
    os.remove(mp3)

async def main():
    n = 0
    for sc in calls:
        for t in sc['turns']:
            text = t['ai']
            h = fid('en', text)
            for suffix, rate in [('', '+0%'), ('.slow', '-30%')]:
                m4a = f'{OUT}/{h}{suffix}.m4a'
                if not os.path.exists(m4a):
                    await tts(text, sc['voice'], rate, m4a)
                    n += 1
            manifest[f'en|{text}'] = {'f': h, 's': 1}
    json.dump(manifest, open(MAN, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('made', n, 'files · manifest', len(manifest))

asyncio.run(main())
