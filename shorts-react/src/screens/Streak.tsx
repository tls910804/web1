import { Button, IconButton } from '../components/Button';
import { Icon } from '../components/Icon';
import { todayCount } from '../lib/srs';
import { useActions } from '../lib/useActions';
import { useStore } from '../store';
import { useUi } from '../ui';

export function monthReviews(log: Record<string, { n: number }>) {
  const d = new Date(), pre = `${d.getFullYear()}-${d.getMonth() + 1}-`;
  return Object.keys(log).reduce((s, k) => s + (k.startsWith(pre) ? log[k].n : 0), 0);
}

export function StreakBroken() {
  const { state } = useStore();
  const { go, streakWas } = useUi();
  const { startToday } = useActions();
  const due = todayCount(state);
  return (
    <section className="screen">
      <div className="brk">
        <div className="hrow"><h2 className="title">연속 기록</h2><IconButton label="닫기" onClick={() => go('feed')}><Icon name="close" /></IconButton></div>
        <div className="streak-card off">
          <div className="fl"><Icon name="flame" /></div>
          <div style={{ minWidth: 0 }}><b>연속 기록이 끊겼어요</b><span>{streakWas}일 동안 이어 왔어요</span></div>
          <span className="best">최고 {state.best}일</span>
        </div>
        <h2 style={{ fontSize: 22, margin: '36px 0 8px' }}>괜찮아요, 오늘부터 다시 시작해요</h2>
        <p className="desc" style={{ fontSize: 14 }}>하루 쉬었다고 지금까지 외운 문장이 사라지지 않아요. 오늘 복습하면 1일째가 시작돼요.</p>
        <div className="tiles" style={{ marginTop: 16 }}>
          <div className="tile"><span>최고 기록</span><b>{state.best}일</b></div>
          <div className="tile"><span>이번 달 복습</span><b>{monthReviews(state.log)}개</b></div>
        </div>
      </div>
      <div className="foot">
        {due ? <Button kind="dark" onClick={() => startToday(state)}>오늘 복습하기 · {due}개</Button> : <Button kind="dark" onClick={() => go('feed')}>둘러보며 저장하기</Button>}
        <Button kind="link" onClick={() => go('feed')}>닫기</Button>
      </div>
    </section>
  );
}
