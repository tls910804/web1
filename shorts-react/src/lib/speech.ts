import { lang } from './text';

export const speechOk = () => 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

export function hasVoice(code: string) {
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return true; // 목록을 아직 못 받았으면 일단 시도
  const p = lang(code).voice.split('-')[0].toLowerCase();
  return vs.some((v) => v.lang && v.lang.toLowerCase().replace('_', '-').indexOf(p) === 0);
}

export function say(text: string, code: string, rate: number, repeat = 1) {
  speechSynthesis.cancel();
  for (let i = 0; i < repeat; i++) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang(code).voice;
    u.rate = rate;
    speechSynthesis.speak(u);
  }
}
