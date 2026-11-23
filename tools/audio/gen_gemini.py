"""Gemini 3.8 TTS(Leda·Iapetus 반반, 자연스럽게+조금 빠르게)로 앱의 문장 음성 만들기. 느리게는 앱이 이 파일을 0.75배로 틀어요(.slow 파일 안 만듦). 표현·단어는 예전 소리 그대로 둬요.

사용: python3 gen_gemini.py [--count] [--limit N] [--langs en,ko,id] [--batch N] [--voice Leda|Iapetus] [--reuse 묶음.wav] [--per-lang N]
  키는 화면에 안 보이게 입력, 저장 안 함.
  덮어쓰기 전에 원래 파일을 backup-before-gemini/ 에 복사해 둬요(Jessica·Edge 원본 보관).
  .gemini_done.json을 보고 이어서 만들어요. --limit N은 문장 N개만 만들고 멈춰요(시험용).
  --batch N은 같은 언어 문장 N개를 한 번 호출로 읽게 하고 쉰 곳에서 잘라요(하루 호출 한도 절약). 실패하면 다시 시도하지 않고 바로 멈춰요.
"""
from trim_tail import split, trim
import ast, base64, getpass, hashlib, json, os, re, shutil, subprocess, sys, time, urllib.error, urllib.request, wave

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(HERE + '/../../shorts-react')
OUT = ROOT + '/public/audio'
BACKUP = HERE + '/backup-before-gemini'
MODEL = os.environ.get('GEMINI_TTS_MODEL', 'gemini-3.8-flash-tts')
VOICES = ['Leda', 'Iapetus']  # 여자·남자 반반. 문장마다 파일 이름으로 정해서 다시 돌려도 같은 목소리
def voice_of(f): return VOICES[int(f[:12], 16) % 2]
NO_SPACE = {'ja', 'zh'}
STYLE = ('Say it in a calm, natural everyday conversational tone, like talking to a friend. No acting, understated. '
         'Speak at a normal, slightly quick native pace, like real everyday talk. Do not speak slowly or pause long between sentences')
SLOW = ('Say it in a calm, natural conversational tone. Speak slowly and clearly so a language learner can follow every word, '
        'but keep it sounding like a real person, not robotic')

cards = json.load(open(ROOT + '/src/data/cards.json')) + json.load(open(ROOT + '/src/data/videos.json'))
_vc = open(ROOT + '/src/lib/feed.ts').read()
_vc = _vc[_vc.index('const VIDEO_CARD'):]
cards.append({'lang': re.search(r"lang: '(\w+)'", _vc).group(1), 'words': ast.literal_eval(re.search(r'words: (\[.*?\]),', _vc).group(1)), 'expr': re.search(r"expr: '([^']*)'", _vc).group(1)})
def fid(lang, text): return hashlib.sha1(f'{lang}|{text}'.encode()).hexdigest()[:12]

jobs = {}  # (lang,text) -> 0 문장(느린 버전도) — gen_eleven.py와 같은 규칙, 표현·단어는 뺌
LANGS = sys.argv[sys.argv.index('--langs') + 1].split(',') if '--langs' in sys.argv else None
for c in cards:
    l = c['lang']
    if LANGS and l not in LANGS: continue
    jobs[(l, ('' if l in NO_SPACE else ' ').join(c['words']))] = 0

ONLY_VOICE = sys.argv[sys.argv.index('--voice') + 1] if '--voice' in sys.argv else None  # 시험용: 이 목소리 문장만
DONE = HERE + '/.gemini_done.json'
done = set(json.load(open(DONE))) if os.path.exists(DONE) else set()
todo = []  # (lang, text, kind, style, file)
for (l, text), kind in sorted(jobs.items(), key=lambda x: (x[1], x[0])):
    for suffix, style in [('', STYLE)]:
        f = f'{fid(l, text)}{suffix}.m4a'
        if f not in done and (not ONLY_VOICE or voice_of(f) == ONLY_VOICE): todo.append((l, text, kind, style, f))
PER = int(sys.argv[sys.argv.index('--per-lang') + 1]) if '--per-lang' in sys.argv else 0
if PER:  # 언어마다 음성 있는 문장이 N개가 될 때까지만. cards.json 앞쪽(먼저 넣은 기본 문장)부터
    order = {k: i for i, k in enumerate(jobs)}
    have = {}
    for l, text in jobs:
        if f'{fid(l, text)}.m4a' in done: have[l] = have.get(l, 0) + 1
    todo.sort(key=lambda t: order[(t[0], t[1])])
    keep = []
    for t in todo:
        if have.get(t[0], 0) < PER: keep.append(t); have[t[0]] = have.get(t[0], 0) + 1
    todo = keep

print(f'남은 파일 {len(todo)}개 · 문장 {sum(t[2] == 0 for t in todo)} · 표현 {sum(t[2] == 1 for t in todo)}')
if '--count' in sys.argv: sys.exit()
limit = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else len(todo)
BATCH = int(sys.argv[sys.argv.index('--batch') + 1]) if '--batch' in sys.argv else 1
REUSE = sys.argv[sys.argv.index('--reuse') + 1] if '--reuse' in sys.argv else None  # 저장된 묶음 녹음을 다시 잘라 쓰기(호출 없음)
KEY = 'x' if REUSE else (os.environ.get('GEMINI_API_KEY') or getpass.getpass('Gemini API 키 (안 보여요): ')).strip()
if not KEY.isascii(): sys.exit('키에 한글이 섞였어요. 영문 입력으로 바꾸고 다시 붙여 넣어 주세요.')

class Stop(Exception): pass  # API 오류: 바로 전체 멈춤
class SplitFail(Exception): pass  # 자르기 실패: 그 묶음만 건너뛰고 다음 묶음 (같은 문장 다시 시도는 안 함)

calls = 0
def speak(text, style, voice):
    """Gemini에 한 번 호출해서 소리(PCM)를 받아요. 실패하면 다시 시도하지 않고 전체를 멈춰요(호출 낭비 금지)"""
    global calls; calls += 1
    # 지시와 대본을 제목으로 나눠야 지시문을 소리 내어 읽지 않아요(systemInstruction은 이 모델에서 500)
    prompt = f"### DIRECTOR'S NOTES (do not read aloud)\n{style}.\n\n#### TRANSCRIPT (read only this)\n{text}"
    body = {'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {'responseModalities': ['AUDIO'],
                                 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}}}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent',
                                 json.dumps(body).encode(), {'Content-Type': 'application/json', 'x-goog-api-key': KEY})
    try:
        res = json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e:
        raise Stop(f'{e.code} {e.read().decode()[:200]}')
    except Exception as e:
        raise Stop(str(e))
    try: return base64.b64decode(res['candidates'][0]['content']['parts'][0]['inlineData']['data'])
    except (KeyError, IndexError): raise Stop('소리 없이 돌아옴')

def save(pcm, dst):
    pcm = trim(pcm)  # 끝에 붙는 '치지직' 잡음 잘라내기
    tmp = dst + '.wav'
    with wave.open(tmp, 'wb') as w:  # 24kHz 16비트 모노
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
    if os.path.exists(dst) and not os.path.exists(f'{BACKUP}/{os.path.basename(dst)}'):
        os.makedirs(BACKUP, exist_ok=True); shutil.copy2(dst, BACKUP)  # 원래 소리는 지우지 않고 보관
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1', tmp, dst], check=True, capture_output=True)
    os.remove(tmp)

BATCH_NOTE = ('. These are separate flashcard sentences, each recorded on its own, not one text. '
              'Read them in order. After every sentence, stop completely and stay silent for two full seconds before the next one. '
              'Never run two sentences together, even short ones. The "..." lines are only silence markers: do not read them. Do not add any words')
def tts_many(group):
    """같은 언어 문장 여러 개 → 파일 이름별 PCM. 잘 못 자르면 한 문장씩 다시 하지 않고 멈춰요"""
    if len(group) == 1: return {group[0][4]: speak(group[0][1], group[0][3], voice_of(group[0][4]))}
    if REUSE:
        with wave.open(REUSE) as w: pcm = w.readframes(w.getnframes())
    else: pcm = speak('\n...\n'.join(t[1] for t in group), group[0][3].replace('. Do not speak slowly or pause long between sentences', '') + BATCH_NOTE, voice_of(group[0][4]))
    parts = split(pcm, [t[1] for t in group])
    if parts: return dict(zip((t[4] for t in group), parts))
    os.makedirs(HERE + '/compare', exist_ok=True)  # 왜 실패했는지 들어 볼 수 있게 남겨요 (compare/는 git에 안 올라가요)
    with wave.open(f'{HERE}/compare/batch-fail-{int(time.time())}.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
    raise SplitFail(f'묶음 {len(group)}개({group[0][0]}, {voice_of(group[0][4])})를 잘 못 잘랐어요. 녹음은 compare/에 저장했어요(--reuse로 호출 없이 다시 자르기)')

manifest = json.load(open(OUT + '/manifest.json'))
made = 0
skipped = streak = 0
try:
    work = sorted(todo[:limit], key=lambda t: (t[0], voice_of(t[4])))
    groups = []  # 같은 언어·같은 목소리끼리 BATCH개씩
    for t in work:
        if groups and len(groups[-1]) < BATCH and (groups[-1][0][0], voice_of(groups[-1][0][4])) == (t[0], voice_of(t[4])): groups[-1].append(t)
        else: groups.append([t])
    for group in groups[:1] if REUSE else groups:
      try: got = tts_many(group)
      except SplitFail as e:
        print('  건너뜀:', e); skipped += 1; streak += 1
        if streak >= 2: raise Stop('자르기가 연속 2번 실패했어요. 같은 문제가 반복되는 것 같아서 호출을 아끼려고 멈춰요')
        continue
      streak = 0
      for l, text, kind, style, f in group:
        if f not in got: print('FAIL', l, text); continue
        save(got[f], f'{OUT}/{f}')
        done.add(f); made += 1
        e = manifest.setdefault(f'{l}|{text}', {'f': f[:12]})
        e['v'] = voice_of(f)
        e.pop('s', None)  # 예전 느린 파일(Jessica) 대신 새 소리를 느리게 틀도록
        if made % 10 == 0:
            print(made, '/', len(todo), flush=True)
            json.dump(sorted(done), open(DONE, 'w'))
except Stop as e:
    print('실패해서 멈춰요:', e)
finally:
    json.dump(sorted(done), open(DONE, 'w'))
    json.dump(manifest, open(OUT + '/manifest.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'이번에 {made}개 만들었어요 · 호출 {calls}번 · 건너뛴 묶음 {skipped}개 · 남은 {len(todo) - made}개')
