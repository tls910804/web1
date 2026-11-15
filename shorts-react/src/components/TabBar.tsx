import { tt } from '../i18n';
import { useStore } from '../store';
import { todayCount } from '../lib/srs';
import { useUi } from '../ui';
import type { Screen } from '../types';
import { Icon } from './Icon';

const TABS: { id: Screen; label: string; icon: 'compass' | 'play' | 'phone' | 'moon' | 'mark' | 'chart' | 'user' }[] = [
  { id: 'feed', label: '둘러보기', icon: 'compass' },
  { id: 'call', label: 'AI 전화', icon: 'phone' },
  // 쉼 탭은 잠시 뺐어요(화면 코드 Rest.tsx와 라우트는 그대로). 다시 넣으려면 아래 줄 주석만 풀면 돼요.
  // { id: 'rest', label: '쉼', icon: 'moon' },
  { id: 'saved', label: '배울래요', icon: 'mark' },
  { id: 'settings', label: '마이', icon: 'user' },
];

export const TAB_SCREENS: Screen[] = ['feed', 'shorts', 'shorts2', 'call', 'rest', 'saved', 'stats', 'settings'];

export function TabBar() {
  const { screen, go } = useUi();
  const { state } = useStore();
  const n = todayCount(state);
  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <button key={t.id} className={`tab${screen === t.id || (t.id === 'feed' && (screen === 'shorts' || screen === 'shorts2')) || (t.id === 'settings' && screen === 'stats') ? ' on' : ''}`} onClick={() => go(t.id)}>
          <span className="ico">
            <Icon name={t.icon} />
            {t.id === 'saved' && n > 0 && <span className="badge" key={n}>{n}</span>}
          </span>
          {tt(t.label)}
        </button>
      ))}
    </nav>
  );
}
