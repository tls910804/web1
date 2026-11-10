import { DAY } from '../constants';
import { tt } from '../i18n';
import { Button, Chip } from '../components/Button';
import { Icon } from '../components/Icon';
import { mastered, minutesFor, todayCount } from '../lib/srs';
import { dayKey, lang, startOfDay, todayKey } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function Stats() {
  const { state } = useStore();
  const { go, statsRange, setStatsRange } = useUi();

  if (!state.saved.length && !Object.keys(state.log).length) {
    return (
      <section className="screen"><div className="page">
        <div className="hrow"><h2 className="title">{tt('기록')}</h2></div>
        <div className="empty-state">
          <div className="em-ico"><Icon name="chart" /></div>
          <b>{tt('아직 기록이 없어요')}</b>
          <p>{tt('문장을 저장하고 복습하면')}<br />{tt('연속 일수와 진행률이 여기에 쌓여요.')}</p>
          <Button kind="dark" onClick={() => go('feed')}>{tt('둘러보러 가기')}</Button>
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
  const due = todayCount(state);
  const doneToday = state.log[todayKey()]?.n || 0;
  const goal = Math.max(state.daily, 1);
  const base = startOfDay(Date.now());
  const sched = Array.from({ length: 7 }, (_, i) => {
    const t = base + i * DAY;
    const n = state.saved.filter((x) => !x.learned && (i === 0 ? x.due < t + DAY : x.due >= t && x.due < t + DAY)).length;
    return { n, label: i === 0 ? tt('오늘') : tt(WEEKDAYS[new Date(t).getDay()]) };
  });
  const heavy = Math.max(...sched.map((d) => d.n));
  const langs = [...new Set(state.saved.map((x) => x.card.lang))];

  return (
    <section className="screen"><div className="page">
      <div className="hrow">
        <h2 className="title">{tt('기록')}</h2>
        <div className="toggle2">
          <Chip on={statsRange === 'week'} onClick={() => setStatsRange('week')}>{tt('주')}</Chip>
          <Chip on={statsRange === 'month'} onClick={() => setStatsRange('month')}>{tt('월')}</Chip>
        </div>
      </div>

      <div className="box">
        <h4>{due ? tt('오늘 복습 {n}개 · 약 {m}분', { n: due, m: minutesFor(due) }) : tt('오늘 복습은 끝났어요')}</h4>
        <div className="prog">
          <div className="t"><b>{tt('오늘 목표')}</b><span>{Math.min(doneToday, goal)} / {goal}</span></div>
          <div className="bar"><div style={{ width: `${Math.min(100, Math.round((doneToday / goal) * 100))}%` }} /></div>
        </div>
      </div>

      {state.streak > 0 ? (
        <div className="streak-card">
          <div className="fl"><Icon name="flame" /></div>
          <div style={{ minWidth: 0 }}><b>{tt('{n}일 연속 복습 중', { n: state.streak })}</b><span>{reviewedToday ? tt('오늘 복습 완료! 내일도 이어 가요') : tt('오늘도 복습하면 {n}일째예요', { n: state.streak + 1 })}</span></div>
          <span className="best">{tt('최고 {n}일', { n: Math.max(state.best, state.streak) })}</span>
        </div>
      ) : (
        <div className="streak-card off">
          <div className="fl"><Icon name="flame" /></div>
          <div style={{ minWidth: 0 }}><b>{tt('오늘 복습으로 시작해요')}</b><span>{tt('매일 복습하면 연속 일수가 쌓여요')}</span></div>
          {state.best > 0 && <span className="best">{tt('최고 {n}일', { n: state.best })}</span>}
        </div>
      )}

      <div className="box">
        <h4>{days === 7 ? tt('최근 7일 복습') : tt('최근 30일 복습')}</h4>
        <div className={`chart${days > 7 ? ' month' : ''}`}>
          {cols.map((c, i) => (
            <div className="col" key={i} title={tt('{n}개', { n: c.n })}>
              <div className={`bar2${c.today ? ' today' : ''}`} style={{ height: `${Math.max(Math.round((c.n / max) * 100), 3)}%` }} />
              {days === 7 && <span>{WEEKDAYS[new Date(c.t).getDay()]}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="box">
        <h4>{tt('복습 일정')}</h4>
        <div className="sched">
          {sched.map((d, i) => (
            <div key={i} className={d.n && d.n === heavy && d.n >= 5 ? 'heavy' : ''}><b>{d.n}</b><span>{d.label}</span></div>
          ))}
        </div>
      </div>

      <div className="tiles">
        <div className="tile"><span>{days === 7 ? tt('이번 주 복습') : tt('이번 달 복습')}</span><b>{tt('{n}개', { n: sum })}</b></div>
        <div className="tile"><span>{tt('정답 비율')}</span><b>{sum ? `${Math.round((ok / sum) * 100)}%` : '—'}</b></div>
      </div>

      {langs.length > 0 && (
        <div className="box">
          <h4>{tt('언어별 진행률')}</h4>
          {langs.map((code) => {
            const items = state.saved.filter((x) => x.card.lang === code);
            const m = items.filter(mastered).length;
            const pct = Math.round((m / items.length) * 100);
            return (
              <div className="prog" key={code}>
                <div className="t"><b>{lang(code).name}</b><span>{tt('외움 {m} / {n}', { m, n: items.length })}</span></div>
                <div className="bar"><div style={{ width: `${Math.max(pct, 2)}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}
      <p className="note">{tt('\'알았어요\'를 세 번 이상 받거나 \'외웠어요\'로 표시한 항목을 외운 것으로 셉니다.')}</p>
    </div></section>
  );
}
