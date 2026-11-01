import { useCallback } from 'react';
import { DAY } from '../constants';
import { useStore } from '../store';
import { useUi } from '../ui';
import { Button } from '../components/Button';
import { notifPerm } from './notify';
import { NotifyPrompt } from '../screens/Sheets';
import { Grab } from '../components/Layer';
import { dueItems, rateResult } from './srs';
import { dayKey, startOfDay, todayKey, wordInfo } from './text';
import type { AppState, Card, Rate, SavedItem } from '../types';

export function itemId(kind: 's' | 'w', card: Card, wi: number, native: string) {
  if (kind === 's') return `s:${card.id}`;
  const i = wordInfo(card, wi, native).wi;
  return `w:${card.id}:${i < 0 ? 'e' : i}`;
}

export function newItem(kind: 's' | 'w', card: Card, wi: number, native: string): SavedItem {
  const now = Date.now();
  return { id: itemId(kind, card, wi, native), kind, card, wi: kind === 'w' ? wordInfo(card, wi, native).wi : -1, learned: false, due: now, at: now, step: 0 };
}

/** 저장 · 복습 · 로그인처럼 여러 화면이 같이 쓰는 동작 */
export function useActions() {
  const { state, set } = useStore();
  const ui = useUi();
  const { toast, openSheet, closeLayer } = ui;

  const findSaved = useCallback((kind: 's' | 'w', card: Card, wi = -1) => {
    const id = itemId(kind, card, wi, state.native);
    return state.saved.find((x) => x.id === id) ?? null;
  }, [state.saved, state.native]);

  const openLogin = useCallback(() => {
    set({ loginAsked: true });
    const by = (name: string) => { set({ account: name }); closeLayer(); toast(`${name}(으)로 로그인했어요 · 데모`); };
    openSheet(
      <>
        <Grab />
        <h3>저장한 단어를 잃지 않으려면</h3>
        <p style={{ margin: '-6px 0 2px', fontSize: 14, color: 'var(--muted)' }}>로그인하면 다른 기기에서도 이어서 볼 수 있어요.</p>
        <Button kind="dark" onClick={() => by('Apple')}><span className="bdg" style={{ background: 'var(--btn-ink)', color: 'var(--btn)' }}>A</span>Apple로 계속하기</Button>
        <Button kind="line" onClick={() => by('Google')}><span className="bdg" style={{ background: '#3b4047', color: '#fff' }}>G</span>Google로 계속하기</Button>
        <Button kind="light" onClick={() => by('이메일')}>이메일로 계속하기</Button>
        <Button kind="link" onClick={closeLayer}>나중에</Button>
      </>,
    );
  }, [set, openSheet, closeLayer, toast]);

  const saveItem = useCallback((kind: 's' | 'w', card: Card, wi = -1) => {
    set((s) => ({ saved: [newItem(kind, card, wi, s.native), ...s.saved] }));
    navigator.vibrate?.(12);
    const login = () => { if (!state.account && !state.loginAsked) openLogin(); };
    // 첫 저장 직후에 알림을 한 번 물어보고, 로그인은 그 다음에 한 번만 권한다
    if (!state.notifyAsked && notifPerm() === 'default') {
      set({ notifyAsked: true });
      toast('배울래요에 저장했어요');
      setTimeout(() => openSheet(<NotifyPrompt then={login} />), 700);
    } else if (!state.account && !state.loginAsked) login();
    else toast('배울래요에 저장했어요');
  }, [set, state.account, state.loginAsked, state.notifyAsked, openLogin, openSheet, toast]);

  const removeItem = useCallback((id: string) => set((s) => ({ saved: s.saved.filter((x) => x.id !== id) })), [set]);

  const toggleSave = useCallback((kind: 's' | 'w', card: Card, wi = -1) => {
    const it = findSaved(kind, card, wi);
    if (it) { removeItem(it.id); toast('저장을 취소했어요'); } else saveItem(kind, card, wi);
  }, [findSaved, removeItem, saveItem, toast]);

  // ----- 복습 -----
  const startReview = useCallback((ids: string[]) => {
    if (!ids.length) return;
    ui.setRv({ ids, i: 0, shown: false, known: [], again: [] });
    ui.go('review');
  }, [ui]);

  const finishStreak = useCallback(() => {
    set((s) => {
      const today = todayKey();
      if (s.lastReview === today) return {};
      const streak = s.lastReview === dayKey(Date.now() - DAY) ? s.streak + 1 : 1;
      return { streak, best: Math.max(s.best || 0, streak), lastReview: today };
    });
  }, [set]);

  const answer = useCallback((r: Rate) => {
    const rv = ui.rv;
    if (!rv) return;
    const item = state.saved.find((x) => x.id === rv.ids[rv.i]);
    let next = { ...rv, known: rv.known, again: rv.again };
    if (item) {
      const res = rateResult(state.mode, item, r);
      set((s) => {
        const k = todayKey();
        const e = s.log[k] || { n: 0, ok: 0 };
        return {
          saved: s.saved.map((x) => (x.id === item.id ? { ...x, step: res.step, due: startOfDay(Date.now()) + res.days * DAY } : x)),
          log: { ...s.log, [k]: { n: e.n + 1, ok: e.ok + (r !== 'again' ? 1 : 0) } },
        };
      });
      next = r === 'again' ? { ...rv, again: [...rv.again, item.id] } : { ...rv, known: [...rv.known, item.id] };
    }
    next = { ...next, i: rv.i + 1, shown: false };
    ui.setRv(next);
    if (next.i >= next.ids.length) { finishStreak(); ui.go('review-done'); }
  }, [ui, state.saved, state.mode, set, finishStreak]);

  const startToday = useCallback((s: AppState) => startReview(dueItems(s).slice(0, s.daily).map((x) => x.id)), [startReview]);

  const exportData = useCallback(() => {
    try {
      const next = { ...state, lastBackup: Date.now() };
      const blob = new Blob([JSON.stringify(next, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `sentence-shorts-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      set({ lastBackup: next.lastBackup });
      toast('파일로 내보냈어요');
    } catch {
      toast('내보내지 못했어요');
    }
  }, [state, set, toast]);

  return { findSaved, saveItem, removeItem, toggleSave, openLogin, startReview, startToday, answer, finishStreak, exportData };
}
