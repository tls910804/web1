"""AI 전화 첫인사(상황마다 첫 대사)를 Google Chirp 3 HD로 미리 만들어요. 즉석 대사와 같은 목소리예요.
(첫인사는 매번 같아서 미리 만들어 두면 통화마다 비용·기다림이 없어요)

사용: python3 tools/audio/gen_call_chirp.py
  키는 화면에 안 보이게 직접 입력해요(getpass). 파일에 저장하지 않아요.
  예전 Edge 음성 파일은 지우지 않고 두고, manifest만 새 파일(…-c.m4a)을 가리켜요.
"""
import base64, getpass, hashlib, json, os, subprocess, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(HERE + '/../../shorts-react')
OUT = ROOT + '/public/audio'
MAN = OUT + '/manifest.json'
VOICE = 'en-US-Chirp3-HD-Kore'  # ai-call-worker/src/policy.ts의 POLICY.voice와 같아야 해요

def fid(lang, text): return hashlib.sha1(f'{lang}|{text}'.encode()).hexdigest()[:12]

key = getpass.getpass('Google Cloud API 키 (Text-to-Speech): ').strip()
manifest = json.load(open(MAN))
for s in json.load(open(ROOT + '/src/data/calls.json')):
    text = s['turns'][0]['ai']
    name = fid('en', text) + '-c'
    m4a = f'{OUT}/{name}.m4a'
    if not os.path.exists(m4a):
        req = urllib.request.Request(
            'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + key,
            data=json.dumps({'input': {'text': text}, 'voice': {'languageCode': 'en-US', 'name': VOICE}, 'audioConfig': {'audioEncoding': 'MP3'}}).encode(),
            headers={'content-type': 'application/json'})
        try:
            audio = base64.b64decode(json.load(urllib.request.urlopen(req, timeout=30))['audioContent'])
        except Exception as e:
            print('실패, 멈춤:', s['id'], repr(e)[:200]); break  # 다시 시도하지 않아요
        open(m4a + '.mp3', 'wb').write(audio)
        subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1', m4a + '.mp3', m4a], check=True, capture_output=True)
        os.remove(m4a + '.mp3')
    manifest[f'en|{text}'] = {'f': name}
    print('완료', s['id'], text)
json.dump(manifest, open(MAN, 'w'), ensure_ascii=False, separators=(',', ':'))
