import { useStore } from '../store';
import { todayCount } from '../lib/srs';
import { useUi } from '../ui';
import type { Screen } from '../types';
import { Icon } from './Icon';

const TABS: { id: Screen; label: string; icon: 'compass' | 'mark' | 'chart' | 'filter' }[] = [
  { id: 'feed', label: '둘러보기', icon: 'compass' },
  { id: 'saved', label: '배울래요', icon: 'mark' },
  { id: 'stats', label: '기록', icon: 'chart' },
  { id: 'settings', label: '설정', icon: 'filter' },
];

export const TAB_SCREENS: Screen[] = ['feed', 'saved', 'stats', 'settings'];

export function TabBar() {
  const { screen, go } = useUi();
  const { state } = useStore();
  const n = todayCount(state);
  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <button key={t.id} className={`tab${screen === t.id ? ' on' : ''}`} onClick={() => go(t.id)}>
          <span className="ico">
            <Icon name={t.icon} />
            {t.id === 'saved' && n > 0 && <span className="badge">{n}</span>}
          </span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
