"""Chatterbox(무료, 내 맥에서 생성) vs Jessica(ElevenLabs) 비교 샘플 → compare/cbx/
실행: .cbx/bin/python compare_chatterbox.py [녹음.wav]   (녹음 파일을 주면 그 목소리로 복제)
"""
import hashlib, json, os, shutil, subprocess, sys, time
import torch, torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..', 'shorts-react')
OUT = os.path.join(HERE, 'compare', 'cbx')
NO_SPACE = {'ja', 'zh'}
LANGS = ['en', 'ko', 'ja', 'zh', 'es', 'fr', 'de', 'pt', 'ru']  # vi·id는 Chatterbox 미지원
PROMPT = sys.argv[1] if len(sys.argv) > 1 else None
def fid(lang, text): return hashlib.sha1(f'{lang}|{text}'.encode()).hexdigest()[:12]

cards = json.load(open(os.path.join(ROOT, 'src/data/cards.json')))
os.makedirs(OUT, exist_ok=True)
dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
model = ChatterboxMultilingualTTS.from_pretrained(device=dev)  # 문자열이어야 CUDA 저장 모델을 CPU로 먼저 읽어요
for n, lang in enumerate(LANGS, 1):
    c = next(c for c in cards if c['lang'] == lang)
    text = ('' if lang in NO_SPACE else ' ').join(c['words'])
    base = os.path.join(OUT, f'{n:02d}-{lang}')
    t = time.time()
    wav = model.generate(text, language_id=lang, audio_prompt_path=PROMPT)
    ta.save(base + '.wav', wav, model.sr)
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '64000', '-c', '1', base + '.wav', base + '-chatterbox.m4a'], check=True)
    os.remove(base + '.wav')
    jess = os.path.join(ROOT, 'public/audio', fid(lang, text) + '.m4a')
    if os.path.exists(jess): shutil.copy(jess, base + '-jessica.m4a')
    print(f'{lang} {time.time() - t:.1f}s  {text}', flush=True)
