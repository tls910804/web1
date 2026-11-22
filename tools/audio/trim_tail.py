"""Gemini TTS가 끝에 붙여 보내는 '치지직'(최대 크기 잡음)을 잘라내요.

사용: python3 trim_tail.py 파일.m4a ...   (원본은 backup-gemini-raw/에 보관하고 고친 파일로 바꿔요)
gen_gemini.py도 만들 때 trim()을 써요.
"""
import array, os, shutil, struct, subprocess, sys, tempfile

def trim(pcm, sr=24000):
    a = array.array('h', pcm[:len(pcm) // 2 * 2])
    w = sr // 50  # 20ms 단위로 끝에서부터 봐요
    end = len(a)
    # 말이 끝나면 조용해졌다가 잡음(최대 크기 ≥30000)이 붙고, 잡음 뒤에 잔향이 조금 남기도 해요.
    # 끝 300ms 안에 잡음이 있으면 잡음 시작에서 자르고, 거기서 조용한 구간(<1000)이 나올 때까지 더 잘라요
    hot = [i for i in range(max(0, end - 15 * w), end, w) if max(map(abs, a[i:i + w]), default=0) >= 30000]
    if hot:
        end = hot[0]
        while end > w and max(abs(x) for x in a[end - w:end]) >= 1000: end -= w
    a = a[:end]
    f = min(len(a), sr // 100)  # 10ms 페이드아웃으로 끊기는 '틱' 소리 방지
    for i in range(f): a[len(a) - f + i] = int(a[len(a) - f + i] * (f - i) / f)
    return a.tobytes()

def split(pcm, texts, sr=24000):
    """문장 여러 개를 한 번에 읽은 소리를, 가장 길게 쉰 곳 n-1군데에서 잘라 문장별 조각으로 나눠요.
    쉰 곳이 모자라거나 조각 길이가 글자 수와 안 맞으면(엉뚱하게 잘림) None → 한 문장씩 다시 만들어요."""
    n = len(texts)
    a = array.array('h', trim(pcm, sr))  # 맨 끝 '치지직' 잡음부터 잘라요 (안 하면 마지막 문장에 붙어요)
    w = sr // 50  # 20ms
    loud = [max(map(abs, a[i:i + w]), default=0) > 600 for i in range(0, len(a), w)]
    # 말은 60ms 넘게 이어져요. 맨 앞 '딱' 소리 같은 한 조각은 말로 치지 않아요
    talk = [k for k in range(len(loud) - 2) if loud[k] and loud[k + 1] and loud[k + 2]]
    if not talk: print('  [자르기] 소리가 거의 없어요'); return None
    first, last = talk[0], len(loud) - 1 - loud[::-1].index(True)
    runs, i = [], first  # 말 사이 조용한 구간 (시작, 끝) 프레임
    while i <= last:
        if not loud[i]:
            j = i
            while not loud[j]: j += 1
            runs.append((i, j)); i = j
        else: i += 1
    cuts = sorted(sorted(runs, key=lambda r: r[0] - r[1])[:n - 1])
    print(f'  [자르기] 쉰 곳 {len(runs)}군데, 긴 순서(ms): {sorted(((e - s) * 20 for s, e in runs), reverse=True)[:n + 2]}')
    if len(cuts) < n - 1 or any(e - s < 13 for s, e in cuts): print('  [자르기] 문장 사이 쉼이 모자라요'); return None  # 260ms보다 짧게 쉬면 문장 사이가 아니에요
    pad = 5  # 100ms 여유
    bounds = [first] + [c for s, e in cuts for c in (s, e)] + [last + 1]
    parts = [(bounds[k], bounds[k + 1]) for k in range(0, len(bounds), 2)]
    ratio = [(e - s) / (len(t) + 8) for (s, e), t in zip(parts, texts)]
    if max(ratio) > 3 * min(ratio): print(f'  [자르기] 조각 길이가 문장과 안 맞아요: {[round(r, 1) for r in ratio]}'); return None
    out = []
    for s, e in parts:
        b = a[max(first - 2, s - pad, 0) * w:min(len(loud), e + pad) * w]
        f = min(len(b), sr // 100)  # 10ms 페이드인으로 시작할 때 '틱' 소리 방지 (끝은 trim()이 페이드아웃)
        for i in range(f): b[i] = int(b[i] * i / f)
        out.append(b.tobytes())
    return out

def fix(path, backup):
    tmp = tempfile.mkdtemp()
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@24000', '-c', '1', path, f'{tmp}/a.wav'], check=True, capture_output=True)
    d = open(f'{tmp}/a.wav', 'rb').read(); i = d.find(b'data'); n = struct.unpack('<I', d[i + 4:i + 8])[0]
    pcm = d[i + 8:i + 8 + n]; out = trim(pcm)
    if len(out) == len(pcm): shutil.rmtree(tmp); return False
    os.makedirs(backup, exist_ok=True)
    if not os.path.exists(f'{backup}/{os.path.basename(path)}'): shutil.copy2(path, backup)
    import wave
    with wave.open(f'{tmp}/b.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(out)
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1', f'{tmp}/b.wav', path], check=True, capture_output=True)
    shutil.rmtree(tmp); return True

if __name__ == '__main__':
    B = os.path.dirname(os.path.abspath(__file__)) + '/backup-gemini-raw'
    n = sum(fix(p, B) for p in sys.argv[1:])
    print(f'{n}/{len(sys.argv) - 1}개 고쳤어요')
