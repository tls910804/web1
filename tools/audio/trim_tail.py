"""Gemini TTS가 끝에 붙여 보내는 '치지직'(최대 크기 잡음)을 잘라내요.

사용: python3 trim_tail.py 파일.m4a ...   (원본은 backup-gemini-raw/에 보관하고 고친 파일로 바꿔요)
gen_gemini.py도 만들 때 trim()을 써요.
"""
import array, math, os, shutil, struct, subprocess, sys, tempfile

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

def pick_cuts(first, last, runs, texts, G=1.0):
    """쉰 곳 중 n-1군데 고르기. 길게 쉰 곳일수록, 조각 길이가 글자 수에 맞을수록 좋아요(동적 계획법).
    Gemini가 두 문장을 거의 안 쉬고 붙여 읽어도 글자 수로 짧은 쉼을 찾아내요. 정상 묶음은 '가장 긴 n-1곳'과 같게 나와요."""
    n = len(texts); R = [r for r in runs if r[1] - r[0] >= 4]  # 80ms보다 짧은 쉼은 문장 사이로 안 봐요
    m = len(R)
    if m < n - 1: return None
    if n == 1: return []
    exp = [len(t) + 8 for t in texts]
    top = sorted((e - s for s, e in R), reverse=True)[:n - 1]
    rate = max((last + 1 - first) - sum(top), 1) / sum(exp)  # 글자 하나에 몇 프레임
    def pc(d, k): return math.log(max(d, 1) / (rate * exp[k])) ** 2
    INF = float('inf')
    dp = [[INF] * m for _ in range(n)]; bk = [[-1] * m for _ in range(n)]  # dp[k][j]: k번째 자르기가 R[j]
    for j in range(m): dp[1][j] = pc(R[j][0] - first, 0) - G * math.log(R[j][1] - R[j][0])
    for k in range(2, n):
        for j in range(k - 1, m):
            best, bi = INF, -1
            for i in range(k - 2, j):
                if dp[k - 1][i] < INF:
                    c = dp[k - 1][i] + pc(R[j][0] - R[i][1], k - 1)
                    if c < best: best, bi = c, i
            if bi >= 0: dp[k][j] = best - G * math.log(R[j][1] - R[j][0]); bk[k][j] = bi
    j = min(range(m), key=lambda j: dp[n - 1][j] + pc(last + 1 - R[j][1], n - 1))
    if dp[n - 1][j] == INF: return None
    out = []
    for k in range(n - 1, 0, -1): out.append(R[j]); j = bk[k][j]
    return out[::-1]

def split(pcm, texts, sr=24000):
    """문장 여러 개를 한 번에 읽은 소리를 pick_cuts()로 고른 n-1군데에서 잘라 문장별 조각으로 나눠요.
    쉰 곳이 모자라거나 조각 길이가 글자 수와 안 맞으면(엉뚱하게 잘림) None → 멈춰요."""
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
    def attempt(first, runs):
        cuts = pick_cuts(first, last, runs, texts)
        if cuts is None: return None
        bounds = [first] + [c for s, e in cuts for c in (s, e)] + [last + 1]
        parts = [(bounds[k], bounds[k + 1]) for k in range(0, len(bounds), 2)]
        return first, parts, [(e - s) / (len(t) + 8) for (s, e), t in zip(parts, texts)]
    got = attempt(first, runs)
    if not got: print('  [자르기] 문장 사이 쉼이 모자라요'); return None
    # 중국어·일본어에서 Gemini가 맨 앞에 지시문을 소리 내 읽을 때가 있어요 → 첫 조각이 유난히 길면
    # 앞 1분 안의 긴 쉼(260ms+) 뒤를 진짜 시작으로 보고, 조각 길이가 가장 고른 쪽을 골라요(그 앞은 버림)
    med = sorted(got[2])[n // 2]
    if max(got[2][:10]) > 3 * med:
        for k, (s, e) in enumerate(runs):
            if s - first > 3000: break
            if e - s >= 13:
                alt = attempt(e, runs[k + 1:])
                if alt and max(alt[2]) / min(alt[2]) < max(got[2]) / min(got[2]): got = alt
        if got[0] != first: print(f'  [자르기] 맨 앞 {round((got[0] - first) * 0.02, 1)}초(지시문 읽은 부분)를 버렸어요')
    first, parts, ratio = got
    pad = 5  # 100ms 여유
    # 느슨하게: 잘못 잘린 건 check_gemini.py 받아쓰기 검수가 잡아요
    if max(ratio) > 8 * min(ratio): print(f'  [자르기] 조각 길이가 문장과 안 맞아요: {[round(r, 1) for r in ratio]}'); return None
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
