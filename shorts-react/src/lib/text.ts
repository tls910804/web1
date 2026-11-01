import { CARDS, GLOSS, LANGS } from '../data';
import { NO_SPACE } from '../constants';
import type { Card } from '../types';

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

// 난이도: 언어마다 문장 길이 순으로 세 등분한다 (짧은 1/3 초급, 가운데 중급, 긴 1/3 고급)
let levelOf_: Record<string, string> | null = null;
export function levelOf(card: Card): string {
  if (!levelOf_) {
    const map: Record<string, string> = {};
    const by: Record<string, Card[]> = {};
    CARDS.forEach((c) => (by[c.lang] ||= []).push(c));
    Object.values(by).forEach((cards) => {
      const list = [...cards].sort((a, b) => sentence(a).length - sentence(b).length);
      list.forEach((c, i) => {
        const r = i / list.length;
        map[c.id] = r < 1 / 3 ? '초급' : r < 2 / 3 ? '중급' : '고급';
      });
    });
    levelOf_ = map;
  }
  return levelOf_[card.id] || '중급';
}

export const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export const todayKey = () => dayKey(Date.now());
