// 언어 코드 → { 한국어 원문: 번역 }. 번역이 없는 문구는 영어(없으면 한국어 원문)로 보인다.
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { id } from './id';
import { ja } from './ja';
import { pt } from './pt';
import { ru } from './ru';
import { vi } from './vi';
import { zh } from './zh';

export const LOCALES: Record<string, Record<string, string>> = { en, ja, zh, es, fr, de, pt, ru, vi, id };
