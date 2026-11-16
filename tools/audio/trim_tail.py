"""Gemini TTS가 끝에 붙여 보내는 '치지직'(최대 크기 잡음)을 잘라내요.

사용: python3 trim_tail.py 파일.m4a ...   (원본은 backup-gemini-raw/에 보관하고 고친 파일로 바꿔요)
gen_gemini.py도 만들 때 trim()을 써요.
"""
import array, os, shutil, struct, subprocess, sys, tempfile

def trim(pcm, sr=24000):
    a = array.array('h', pcm[:len(pcm) // 2 * 2])
    w = sr // 50  # 20ms 단위로 끝에서부터 봐요
    end = len(a)
    # 말이 끝나면 조용해졌다가 잡음이 붙어요: 끝에서부터 조용한 구간(<1000)이 나올 때까지 잘라요
    if max(abs(x) for x in a[end - w:end]) >= 30000:
        while end > w and max(abs(x) for x in a[end - w:end]) >= 1000: end -= w
    a = a[:end]
    f = min(len(a), sr // 100)  # 10ms 페이드아웃으로 끊기는 '틱' 소리 방지
    for i in range(f): a[len(a) - f + i] = int(a[len(a) - f + i] * (f - i) / f)
    return a.tobytes()

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
