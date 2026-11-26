import { setUiLang } from './i18n';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { STORE_KEY } from './constants';
import { ON_LANGS } from './data';
import type { AppState } from './types';

const defaults: AppState = {
  onboarded: false,
  native: 'ko',
  learn: ['en'],
  saved: [],
  custom: [],
  known: [],
  hideTr: false,
  tapped: false,
  account: null,
  loginAsked: false,
  streak: 0,
  best: 0,
  lastReview: null,
  log: {},
  level: '전체',
  auto: true,
  autoRepeat: 1,
  speed: 1,
  mode: 'std',
  daily: 10,
  fontSize: 'md',
  theme: 'light',
  notify: { morning: false, evening: false },
  notified: {},
  notifyAsked: false,
  lastBackup: null,
  vocab: {},
  vocabTopic: '',
  vocabGoal: 20,
  vocabDays: [],
  vocabStar: [],
  vocabMute: false,
  vocabFree: { n: 0, day: '', today: 0, done: '' },
  vocabRun: { code: '', ids: [], done: [], miss: [], knew: [] },
};

// 이전 버전 데이터도 그대로 읽도록 기본값 위에 덮어쓴다 (저장 키는 기존 앱과 같다)
export function normalize(raw: Partial<AppState>): AppState {
  const s = { ...defaults, ...raw } as AppState;
  // 모양이 틀린 값(손상되거나 손으로 고친 백업 파일)은 기본값으로 되돌려 앱이 멈추지 않게 한다
  const all = s as unknown as Record<string, unknown>;
  for (const [k, d] of Object.entries(defaults)) {
    const v = all[k];
    const ok = d === null ? v === null || typeof v === 'string' || typeof v === 'number'
      : Array.isArray(d) ? Array.isArray(v) : v !== null && typeof v === typeof d;
    if (!ok) all[k] = d;
  }
  // 예전 '천천히 듣기' 켜 둔 사람은 조금 느리게로
  const old = all.slow; delete all.slow;
  if (raw.speed === undefined && old === true) s.speed = 0.8;
  if (![1, 0.8, 0.6].includes(s.speed)) s.speed = 1;
  if (![10, 20, 30].includes(s.vocabGoal)) s.vocabGoal = 20;
  s.custom = s.custom.filter((c) => Array.isArray(c?.words));
  s.saved = s.saved.filter((x) => typeof x?.id === 'string' && Array.isArray(x.card?.words)).map((x) => {
    const item = { ...x };
    if (item.wi === undefined) {
      item.wi = -1;
      if (item.kind === 'w' && item.id.split(':').length === 2) item.id += ':e';
    }
    if (item.step === undefined) item.step = 0;
    return item;
  });
  if (!s.best || s.best < s.streak) s.best = s.streak;
  // 숨긴 언어를 배울 언어로 골라 둔 경우 빼요 (내 언어는 11개 다 돼요)
  s.learn = s.learn.filter((c) => ON_LANGS.includes(c) && c !== s.native);
  return s;
}

function load(): AppState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
    return normalize(JSON.parse(raw || '{}') || {});
  } catch {
    // 곧 기본값이 같은 키에 저장되므로, 읽지 못한 원본은 지우지 않고 따로 남겨 둔다
    try { if (raw) localStorage.setItem(`${STORE_KEY}-broken`, raw); } catch { /* 공간이 없으면 포기 */ }
    return normalize({});
  }
}

type Patch = Partial<AppState> | ((s: AppState) => Partial<AppState>);

interface Store {
  state: AppState;
  set: (patch: Patch) => void;
  replace: (s: AppState) => void;
  saveFailed: boolean;
  retrySave: () => boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load);
  const [saveFailed, setSaveFailed] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  setUiLang(state.native); // 화면 문구는 내 언어를 따른다 (i18n.ts)

  const write = useCallback((s: AppState) => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
      setSaveFailed(false);
      return true;
    } catch {
      setSaveFailed(true);
      return false;
    }
  }, []);

  useEffect(() => { write(state); }, [state, write]);

  // 다른 탭에서 저장하면 이 탭도 그 내용으로 맞춘다 (한쪽 저장이 다른 쪽 저장을 덮어쓰지 않게)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORE_KEY || !e.newValue) return;
      try { setState(normalize(JSON.parse(e.newValue))); } catch { /* 깨진 값이면 지금 상태 유지 */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const set = useCallback((patch: Patch) => {
    setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  }, []);
  const replace = useCallback((s: AppState) => setState(normalize(s)), []);
  const retrySave = useCallback(() => write(stateRef.current), [write]);

  const value = useMemo(() => ({ state, set, replace, saveFailed, retrySave }), [state, set, replace, saveFailed, retrySave]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider 안에서만 쓸 수 있어요');
  return v;
}
