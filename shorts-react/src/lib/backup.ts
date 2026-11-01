import type { AppState } from '../types';

export function exportBackup(state: AppState) {
  const blob = new Blob([JSON.stringify({ ...state, lastBackup: Date.now() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sentence-shorts-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
