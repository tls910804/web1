"""Piper 음성 모델(onnx)을 직접 돌리는 합성기. 발음 기호는 Homebrew espeak-ng로 만든다."""
import json, re, subprocess, unicodedata, wave
import numpy as np
import onnxruntime as ort

ESPEAK = '/opt/homebrew/bin/espeak-ng'

class Voice:
    def __init__(self, key):
        self.cfg = json.load(open(f'voices/{key}.onnx.json'))
        self.sess = ort.InferenceSession(f'voices/{key}.onnx', providers=['CPUExecutionProvider'])
        self.map = self.cfg['phoneme_id_map']
        self.sr = self.cfg['audio']['sample_rate']
        self.multi = self.cfg.get('num_speakers', 1) > 1
        self.type = self.cfg.get('phoneme_type', 'espeak')

    def phonemes(self, text):
        if self.type == 'espeak':
            out = subprocess.run([ESPEAK, '-q', '--ipa', '-v', self.cfg['espeak']['voice'], text],
                                 capture_output=True, text=True, check=True).stdout
            ph = ' '.join(l.strip() for l in out.splitlines() if l.strip())
            ph = re.sub(r'\([^)]+\)', '', ph)  # 다른 언어로 바뀌는 표시 제거
            end = re.search(r'[.!?,:;]+\s*$', text)
            if end and end.group(0).strip()[-1] in self.map: ph += end.group(0).strip()[-1]
            return ph
        if not hasattr(self, '_ja'):
            from piper.phonemize_japanese import JapanesePhonemizer
            self._ja = JapanesePhonemizer()
        return ''.join(''.join(sent) for sent in self._ja.phonemize(text))

    def ids(self, ph):
        ids = list(self.map['^'])
        for p in unicodedata.normalize('NFD', ph):
            if p in self.map:
                ids += self.map[p] + self.map['_']
        return ids + self.map['$']

    def run(self, text, length_scale=1.0):
        ids = self.ids(self.phonemes(text))
        inp = {
            'input': np.array([ids], dtype=np.int64),
            'input_lengths': np.array([len(ids)], dtype=np.int64),
            'scales': np.array([self.cfg['inference']['noise_scale'], length_scale, self.cfg['inference']['noise_w']], dtype=np.float32),
        }
        if self.multi: inp['sid'] = np.array([0], dtype=np.int64)
        a = self.sess.run(None, inp)[0].squeeze()
        a = a / max(0.01, np.abs(a).max()) * 0.9
        return (a * 32767).astype(np.int16)

    def wav(self, text, path, length_scale=1.0):
        a = self.run(text, length_scale)
        with wave.open(path, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(self.sr); w.writeframes(a.tobytes())
