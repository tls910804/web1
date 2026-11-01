import type { FontKey, ModeKey, ThemeKey } from './types';

export const STORE_KEY = 'sentence-shorts-v1';
export const DAY = 24 * 60 * 60 * 1000;
export const NO_SPACE: Record<string, boolean> = { ja: true, zh: true };
export const LEVELS = ['전체', '초급', '중급', '고급'];

// 복습 방식별 간격(일). 단계가 오를수록 다음 간격을 쓴다.
export const MODES: Record<ModeKey, { name: string; days: number[] }> = {
  std: { name: '표준', days: [1, 3, 7, 14] },
  slow: { name: '천천히', days: [2, 5, 10, 21] },
  dense: { name: '촘촘하게', days: [1, 2, 4, 7] },
};
export const FONT_SIZES: Record<FontKey, { name: string; v: number }> = {
  sm: { name: '작게', v: 0.88 },
  md: { name: '보통', v: 1 },
  lg: { name: '크게', v: 1.15 },
};
export const THEMES: Record<ThemeKey, string> = { light: '라이트', dark: '다크', system: '시스템' };

export const ICON = {
  speak: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  mark: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  flame: '<path d="M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 2.5 2.5 2.5 4 1-1.5 1-5.5.5-8z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>',
  warn: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
  chart: '<path d="M6 20V11M12 20V5M18 20v-6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  bell: '<path d="M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0"/>',
  filter: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  skip: '<path d="M6 5l10 7-10 7z"/><path d="M19 5v14"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  offline: '<path d="M2 8.5a15 15 0 0 1 5-3M22 8.5a15 15 0 0 0-11-4M5 12.5a10 10 0 0 1 4-2.3M19 12.5a10 10 0 0 0-3-2M8.5 16a5 5 0 0 1 7 0M3 3l18 18"/><circle cx="12" cy="19.5" r="1"/>',
} as const;
