import { GLOSS, LANGS } from '../data';
import { NO_SPACE } from '../constants';
import type { Card } from '../types';

/** 글꼴을 고르는 데 쓰는 언어 태그. 중국어는 간체/번체가 글꼴이 달라서 구분한다 */
export const langTag = (code: string) => (code === 'zh' ? 'zh-Hans' : code);

export function lang(code: string) {
  return LANGS.find((l) => l.code === code) ?? LANGS[0];
}

export function trOf(obj: Record<string, string> | undefined, native: string): string {
  if (!obj) return '';
  return obj[native] || obj.ko || obj.en || Object.values(obj)[0] || '';
}

export const sentence = (card: Card) => card.words.join(NO_SPACE[card.lang] ? '' : ' ');
export const clean = (w: string) => w.replace(/^[¡¿\s]+|[.,!?。、！？\s]+$/g, '');

function glossOf(card: Card, wi: number, native: string) {
  const g = GLOSS[card.id]?.[wi] || '';
  if (!g) return '';
  const p = g.split('|');
  return native === 'ko' ? p[0] || p[1] || '' : p[1] || p[0] || '';
}

export interface WordInfo { wi: number; expr: boolean; text: string; mean: string; speak: string }

// 단어 조각 하나의 정보. 핵심 표현 조각은 표현 전체(expr)로 합쳐서 다룬다.
export function wordInfo(card: Card, wi: number, native: string): WordInfo {
  if (wi < 0 || card.key.includes(wi)) {
    return { wi: -1, expr: true, text: card.expr, mean: trOf(card.mean, native), speak: card.expr.replace(/\s*\(.*\)$/, '') };
  }
  const t = clean(card.words[wi]);
  return { wi, expr: false, text: t, mean: glossOf(card, wi, native), speak: t };
}

// 난이도: 문장 데이터의 level(사람이 매긴 값). 없는 문장(직접 추가 등)은 길이로 대충 추정
export function levelOf(card: Card): string {
  if (card.level) return card.level;
  const n = card.words.length;
  return n <= 5 ? '초급' : n <= 9 ? '중급' : '고급';
}

export const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export const todayKey = () => dayKey(Date.now());
