import json, hashlib, os, re, subprocess, sys
from synth import Voice

ROOT = '/Users/sinseunghwa/Desktop/정리/코딩/langshort/shorts-react'
OUT = ROOT + '/public/audio'
NO_SPACE = {'ja': 1, 'zh': 1}
pick = json.load(open('pick.json'))
cards = json.load(open(ROOT + '/src/data/cards.json'))
os.makedirs(OUT, exist_ok=True)

def clean(w): return re.sub(r'^[¡¿\s]+|[.,!?。、！？\s]+$', '', w)
def fid(lang, text): return hashlib.sha1(f'{lang}|{text}'.encode()).hexdigest()[:12]

jobs = {}   # (lang,text) -> slow?
for c in cards:
    l = c['lang']
    jobs[(l, ('' if l in NO_SPACE else ' ').join(c['words']))] = True
    if c['expr']: jobs.setdefault((l, re.sub(r'\s*\(.*\)$', '', c['expr'])), False)
    for w in c['words']:
        t = clean(w)
        if t: jobs.setdefault((l, t), False)
print(len(jobs), 'texts', sum(jobs.values()), 'sentences')

voices = {}
manifest = {}
done = 0
for (l, text), sentence in sorted(jobs.items()):
    v = voices.get(l) or voices.setdefault(l, Voice(pick[l]))
    h = fid(l, text)
    variants = [('', 1.0)] + ([('.slow', 1.45)] if sentence else [])
    entry = {'f': h}
    for suffix, ls in variants:
        m4a = f'{OUT}/{h}{suffix}.m4a'
        if not os.path.exists(m4a):
            wav = f'/tmp/_g_{h}.wav'
            try:
                v.wav(text, wav, ls)
                subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '40000', '-c', '1', wav, m4a], check=True, capture_output=True)
            except Exception as e:
                print('FAIL', l, text, repr(e)[:80]); entry = None; break
            finally:
                if os.path.exists(wav): os.remove(wav)
    if entry:
        if sentence: entry['s'] = 1
        manifest[f'{l}|{text}'] = entry
    done += 1
    if done % 100 == 0: print(done, flush=True)
json.dump(manifest, open(OUT + '/manifest.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('manifest', len(manifest))
