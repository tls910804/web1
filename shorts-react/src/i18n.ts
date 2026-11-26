// 문구는 한국어 원문을 키로 쓴다: tt('저장한 날'). 다른 언어는 locales/<코드>.ts 에 { '저장한 날': 'Saved on' } 형태로 추가한다.
// 숫자·단어가 끼는 문구는 틀로 쓴다: tt('{n}일 뒤', { n })
import { LOCALES } from './locales';

let cur = 'ko';
export const setUiLang = (code: string) => { cur = code; };
export const uiLang = () => cur;

export function tt(src: string, p?: Record<string, string | number>) {
  // 한국어가 아닌데 그 언어 번역이 없으면 영어로 (한국어 원문보다 읽기 쉬워요)
  let s = LOCALES[cur]?.[src] ?? (cur === 'ko' ? undefined : LOCALES.en[src]) ?? src;
  if (p) s = s.replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? ''));
  return s;
}
