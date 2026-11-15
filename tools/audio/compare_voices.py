"""ElevenLabs 여러 목소리 × 모델로 같은 긴 영어 문장 만들기 → compare/voice-<모델>-<이름>.m4a
키는 처음 한 번만 물어보고 tools/audio/.eleven_key 에 저장해요(git에 안 올라가요)."""
import getpass, json, os, subprocess, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT, KF = HERE + '/compare', HERE + '/.eleven_key'
KEY = os.environ.get('ELEVEN_API_KEY') or (open(KF).read() if os.path.exists(KF) else '')
if not KEY.strip():
    KEY = getpass.getpass('ElevenLabs 키 붙여 넣고 Enter (화면엔 안 보여요): ')
KEY = KEY.strip()
if not KEY.isascii(): raise SystemExit('키에 한글 같은 글자가 섞였어요. 영어 입력으로 다시 붙여 넣어 주세요.')
open(KF, 'w').write(KEY); os.chmod(KF, 0o600)

import sys
LANG = sys.argv[1] if len(sys.argv) > 1 else 'en'  # 사용: python3 compare_voices.py ko Jessica
ONLY = sys.argv[2:]
TEXTS = {'ko': "아 미안, 좀 늦었지? 오늘 아침에 길이 진짜 막혀서, 휴대폰까지 집에 두고 나왔어. "
               "근데 벌써 주문했어? 나 너무 배고파. 일단 간단하게 뭐 좀 먹고, 내일 계획 얘기하자."}
TEXT = ("Hey, sorry I'm late. The traffic was crazy this morning, and I totally forgot my phone at home. "
        "Anyway, did you already order? I'm starving. Let's grab something quick and then go over the plan for tomorrow.")
VOICES = {'Sarah': 'EXAVITQu4vr4xnSDxMaL', 'Jessica': 'cgSgspJ2msm6clMCkdW9', 'Laura': 'FGY2WhTYpPnrIDTdsKH5',
          'Liam': 'TX3LPaxmHKxFdv7VOQHJ', 'Chris': 'iP95p4xoKVk53GoZ742B'}
MODELS = ['eleven_v3']  # 가장 감정 표현이 풍부한 모델

for model in MODELS:
    for name, vid in VOICES.items():
        if ONLY and name not in ONLY: continue
        dst = f'{OUT}/voice-{model}-{name}' + ('' if LANG == 'en' else f'-{LANG}') + '.m4a'
        req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_128',
                                     json.dumps({'text': TEXTS.get(LANG, TEXT), 'model_id': model}).encode(),
                                     {'Content-Type': 'application/json', 'xi-api-key': KEY})
        try:
            open(dst + '.mp3', 'wb').write(urllib.request.urlopen(req, timeout=180).read())
        except urllib.error.HTTPError as e:
            print('실패', model, name, e.code, e.read().decode()[:200]); continue
        subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '64000', '-c', '1', dst + '.mp3', dst], check=True, capture_output=True)
        os.remove(dst + '.mp3')
        print('OK', model, name)
