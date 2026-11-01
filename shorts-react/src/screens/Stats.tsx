import { DAY } from '../constants';
import { Button, Chip } from '../components/Button';
import { Icon } from '../components/Icon';
import { mastered } from '../lib/srs';
import { dayKey, lang, todayKey } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function Stats() {
  const { state } = useStore();
  const { go, statsRange, setStatsRange } = useUi();

  if (!state.saved.length && !Object.keys(state.log).length) {
    return (
      <section className="screen"><div className="page">
        <div className="hrow"><h2 className="title">기록</h2></div>
        <div className="empty-state">
          <div className="em-ico"><Icon name="chart" /></div>
          <b>아직 기록이 없어요</b>
          <p>문장을 저장하고 복습하면<br />연속 일수와 진행률이 여기에 쌓여요.</p>
          <Button kind="dark" onClick={() => go('feed')}>둘러보러 가기</Button>
        </div>
      </div></section>
    );
  }

  const reviewedToday = state.lastReview === todayKey();
  const days = statsRange === 'week' ? 7 : 30;
  const cols: { t: number; n: number; today: boolean }[] = [];
  let max = 1, sum = 0, ok = 0;
  for (let i = days - 1; i >= 0; i--) {
    const t = Date.now() - i * DAY, e = state.log[dayKey(t)] || { n: 0, ok: 0 };
    cols.push({ t, n: e.n, today: i === 0 });
    max = Math.max(max, e.n); sum += e.n; ok += e.ok;
  }
  const langs = [...new Set(state.saved.map((x) => x.card.lang))];

  return (
    <section className="screen"><div className="page">
      <div className="hrow">
        <h2 className="title">기록</h2>
        <div className="toggle2">
          <Chip on={statsRange === 'week'} onClick={() => setStatsRange('week')}>주</Chip>
          <Chip on={statsRange === 'month'} onClick={() => setStatsRange('month')}>월</Chip>
        </div>
      </div>

      {state.streak > 0 ? (
        <div className="streak-card">
          <div className="fl"><Icon name="flame" /></div>
          <div style={{ minWidth: 0 }}><b>{state.streak}일 연속 복습 중</b><span>{reviewedToday ? '오늘 복습 완료! 내일도 이어 가요' : `오늘도 복습하면 ${state.streak + 1}일째예요`}</span></div>
          <span className="best">최고 {Math.max(state.best, state.streak)}일</span>
        </div>
      ) : (
        <div className="streak-card off">
          <div className="fl"><Icon name="flame" /></div>
          <div style={{ minWidth: 0 }}><b>오늘 복습으로 시작해요</b><span>매일 복습하면 연속 일수가 쌓여요</span></div>
          {state.best > 0 && <span className="best">최고 {state.best}일</span>}
        </div>
      )}

      <div className="box">
        <h4>{days === 7 ? '최근 7일' : '최근 30일'} 복습</h4>
        <div className={`chart${days > 7 ? ' month' : ''}`}>
          {cols.map((c, i) => (
            <div className="col" key={i} title={`${c.n}개`}>
              <div className={`bar2${c.today ? ' today' : ''}`} style={{ height: `${Math.max(Math.round((c.n / max) * 100), 3)}%` }} />
              {days === 7 && <span>{WEEKDAYS[new Date(c.t).getDay()]}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="tiles">
        <div className="tile"><span>{days === 7 ? '이번 주' : '이번 달'} 복습</span><b>{sum}개</b></div>
        <div className="tile"><span>정답 비율</span><b>{sum ? `${Math.round((ok / sum) * 100)}%` : '—'}</b></div>
      </div>

      {langs.length > 0 && (
        <div className="box">
          <h4>언어별 진행률</h4>
          {langs.map((code) => {
            const items = state.saved.filter((x) => x.card.lang === code);
            const m = items.filter(mastered).length;
            const pct = Math.round((m / items.length) * 100);
            return (
              <div className="prog" key={code}>
                <div className="t"><b>{lang(code).name}</b><span>외움 {m} / {items.length}</span></div>
                <div className="bar"><div style={{ width: `${Math.max(pct, 2)}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}
      <p className="note">'알았어요'를 세 번 이상 받거나 '외웠어요'로 표시한 항목을 외운 것으로 셉니다.</p>
    </div></section>
  );
}
