import { DAY } from '../constants';
import { tt } from '../i18n';
import { Icon } from '../components/Icon';
import { mastered, minutesFor, todayCount } from '../lib/srs';
import { dayKey, lang, sentence, startOfDay, trOf, wordInfo } from '../lib/text';
import { useActions } from '../lib/useActions';
import { useStore } from '../store';
import { useUi } from '../ui';
import type { AppState } from '../types';

const WD = ['월', '화', '수', '목', '금', '토', '일'];
type Log = AppState['log'][string];
/** 그날 한 일의 양: 복습 + 자동 공부 문장 + AI 전화 */
const amount = (e?: Log) => (e ? e.n + (e.s || 0) + (e.c || 0) : 0);
const level = (n: number) => (n === 0 ? 0 : n < 5 ? 1 : n < 15 ? 2 : 3);

/** 하루라도 뭔가 한 날이 끊기지 않고 이어진 일수 (오늘 아직 안 했으면 어제까지) */
export function streakOf(log: AppState['log']) {
  const now = Date.now();
  let n = 0;
  for (let i = amount(log[dayKey(now)]) ? 0 : 1; i < 400 && amount(log[dayKey(now - i * DAY)]); i++) n++;
  return n;
}

/** 한 달 달력 (연속 기록을 누르면) */
function MonthSheet({ streak, best }: { streak: number; best: number }) {
  const { state } = useStore();
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const first = (new Date(y, m, 1).getDay() + 6) % 7; // 월요일 시작
  const last = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: last }, (_, i) => i + 1)];
  const active = Array.from({ length: last }, (_, i) => amount(state.log[dayKey(new Date(y, m, i + 1).getTime())])).filter(Boolean).length;
  return (
    <div className="st-month">
      <div className="grab" />
      <div className="hd"><h3>{tt('{m}월', { m: m + 1 })}</h3><small>{tt('이번 달 {n}일 공부', { n: active })}</small></div>
      <div className="cal">
        {WD.map((d) => <span key={d} className="wd">{tt(d)}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const lv = d > now.getDate() ? -1 : level(amount(state.log[dayKey(new Date(y, m, d).getTime())]));
          return <span key={i} className={`d l${lv}${d === now.getDate() ? ' today' : ''}`}>{d}</span>;
        })}
      </div>
      <div className="lg"><small>{tt('적게')}</small>{[0, 1, 2, 3].map((l) => <i key={l} className={`l${l}`} />)}<small>{tt('많이')}</small></div>
      <div className="three">
        <div><b>{tt('{n}일', { n: streak })}</b><small>{tt('지금 연속')}</small></div>
        <div><b>{tt('{n}일', { n: best })}</b><small>{tt('최고 기록')}</small></div>
        <div><b>{tt('{n}일', { n: active })}</b><small>{tt('이번 달')}</small></div>
      </div>
    </div>
  );
}

export function Stats() {
  const { state } = useStore();
  const { go, openSheet } = useUi();
  const { startToday, startReview } = useActions();
  const now = Date.now();
  const today = startOfDay(now);
  const dow = (new Date(today).getDay() + 6) % 7;
  const mon = today - dow * DAY;
  const streak = streakOf(state.log);
  const best = Math.max(state.best, streak);
  const doneToday = amount(state.log[dayKey(now)]) > 0;
  const week = WD.map((d, i) => ({ d, done: amount(state.log[dayKey(mon + i * DAY)]) > 0, today: i === dow }));
  const due = todayCount(state);

  const head = (
    <>
      <div className="hrow st2-hd"><button className="back" aria-label={tt('마이로')} onClick={() => go('settings')}><Icon name="back" /></button><h2 className="title">{tt('내 기록')}</h2></div>
      <button className="st2-card streak" onClick={() => openSheet(<MonthSheet streak={streak} best={best} />)}>
        <span className="top">
          <span className={`fl${streak ? '' : ' off'}`}><Icon name="flame" /></span>
          {streak
            ? <span className="tx"><b><em>{streak}</em>{tt('일 연속')}</b><small>{doneToday ? tt('최고 {n}일 · 오늘도 했어요', { n: best }) : tt('최고 {n}일 · 오늘도 하면 {m}일', { n: best, m: streak + 1 })}</small></span>
            : <span className="tx"><b>{tt('오늘 첫 기록을 시작해요')}</b><small>{tt('하루 1문장만 해도 연속 기록이 쌓여요')}</small></span>}
          <Icon name="chev" />
        </span>
        <span className="week">
          {week.map((w) => (
            <span key={w.d} className={`${w.done ? 'wd-on' : ''}${w.today ? ' wd-today' : ''}`}><i>{w.done && <Icon name="check" />}</i>{tt(w.d)}</span>
          ))}
        </span>
      </button>
    </>
  );

  // 기록이 하나도 없을 때: 빈 그래프 대신 할 일 하나
  if (!state.saved.length && !Object.keys(state.log).length) {
    return (
      <section className="screen"><div className="page st2">
        {head}
        <button className="st2-go" onClick={() => go('feed')}>{tt('10문장 공부 시작')}</button>
        <div className="st2-card">
          <b className="h">{tt('앞으로 여기에 쌓여요')}</b>
          {[tt('외운 표현 수와 이번 주 새로 담은 수'), tt('이번 주 복습 · 자동 공부 · AI 전화'), tt('자꾸 헷갈리는 문장 → 바로 복습')].map((t) => <p key={t} className="st2-li">{t}</p>)}
        </div>
      </div></section>
    );
  }

  const learned = state.saved.filter(mastered).length;
  const learning = state.saved.filter((x) => !mastered(x) && x.step > 0).length;
  const fresh = state.saved.length - learned - learning;
  const newThisWeek = state.saved.filter((x) => x.at >= mon).length;
  const langs = [...new Set(state.saved.map((x) => x.card.lang))];
  const sum = (k: 'n' | 's' | 'c') => Array.from({ length: dow + 1 }, (_, i) => state.log[dayKey(mon + i * DAY)]?.[k] || 0).reduce((a, b) => a + b, 0);
  const weak = state.saved.filter((x) => !x.learned && (x.lapses || 0) > 0).sort((a, b) => (b.lapses || 0) - (a.lapses || 0)).slice(0, 3);
  const pct = (n: number) => `${(n / Math.max(1, state.saved.length)) * 100}%`;

  return (
    <section className="screen"><div className="page st2">
      {head}
      <div className="st2-todo">
        {due
          ? <><span><b>{tt('오늘 복습 {n}개 남았어요', { n: due })}</b><small>{tt('약 {m}분이면 끝나요', { m: minutesFor(due) })}</small></span><button onClick={() => startToday(state)}>{tt('이어서 하기')}</button></>
          : <><span><b>{doneToday ? tt('오늘 복습은 끝났어요') : tt('오늘 복습할 문장이 없어요')}</b><small>{tt('새 문장으로 공부해 볼까요?')}</small></span><button onClick={() => go('feed')}>{tt('공부하기')}</button></>}
      </div>

      <div className="st2-card">
        <div className="st2-row"><span><small className="lbl">{tt('외운 표현')}</small><b className="big">{learned}<em>{tt('개')}</em></b></span>{newThisWeek > 0 && <span className="up">{tt('이번 주 +{n} 담음', { n: newThisWeek })}</span>}</div>
        <div className="stack"><i className="a" style={{ width: pct(learned) }} /><i className="b" style={{ width: pct(learning) }} /><i className="c" style={{ width: pct(fresh) }} /></div>
        <div className="legend"><span><i className="a" />{tt('외움 {n}', { n: learned })}</span><span><i className="b" />{tt('외우는 중 {n}', { n: learning })}</span><span><i className="c" />{tt('새로 담음 {n}', { n: fresh })}</span></div>
        {langs.length > 1 && (
          <div className="langs">{langs.map((c) => { const it = state.saved.filter((x) => x.card.lang === c); return <span key={c}><small>{lang(c).ko}</small><b>{it.filter(mastered).length} / {it.length}</b></span>; })}</div>
        )}
      </div>

      <div className="st2-card">
        <b className="h">{tt('이번 주 한 일')}</b>
        <div className="tiles3">
          <span className="r"><b>{sum('n')}<em>{tt('개')}</em></b><small>{tt('복습')}</small></span>
          <span className="s"><b>{sum('s')}<em>{tt('문장')}</em></b><small>{tt('자동 공부')}</small></span>
          <span className="c"><b>{sum('c')}<em>{tt('번')}</em></b><small>{tt('AI 전화')}</small></span>
        </div>
      </div>

      {weak.length > 0 && (
        <div className="st2-card weak">
          <div className="st2-row"><b className="h">{tt('자꾸 헷갈리는 문장')}</b><span className="cnt">{tt('{n}개', { n: weak.length })}</span></div>
          {weak.map((x) => (
            <div key={x.id} className="wk">
              {(() => { const w = x.kind === 'w' ? wordInfo(x.card, x.wi, state.native) : null; return <span><b lang={x.card.lang}>{w ? w.text : sentence(x.card)}</b><small>{w ? (w.mean || sentence(x.card)) : trOf(x.card.tr, state.native)}</small></span>; })()}
              <i>{tt('{n}번 틀림', { n: x.lapses || 0 })}</i>
            </div>
          ))}
          <button className="st2-dark" onClick={() => startReview(weak.map((x) => x.id))}>{tt('이 {n}개만 복습하기', { n: weak.length })}</button>
        </div>
      )}
    </div></section>
  );
}
