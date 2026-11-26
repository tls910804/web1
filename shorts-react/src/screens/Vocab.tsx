import { useEffect, useState, type ReactNode } from 'react';
import { tt } from '../i18n';
import { Button, Chip } from '../components/Button';
import { Icon } from '../components/Icon';
import WORDS from '../data/words.json';
import TOPIC_DATA from '../data/word-topics.json';
import { langName, langTag } from '../lib/text';
import { buildSteps, cloze, dueAt, hintShape, KNOWN, knownLog, nextBox, pickSession, placementIds, todayCount, freeLeft, FREE_WORDS, SESSION, dayOf, dayStreak, weekOf, why, type Op, type Step } from '../lib/vocab';
import { useStore } from '../store';
import { useUi } from '../ui';
import type { AppState } from '../types';

// [단어, 뜻, 예문, 예문 뜻, 예문 속 모양(활용형일 때만)]. 영어 단어의 뜻은 한국어, 한국어 단어의 뜻은 영어
// shortcut: 앱에 묶어 둠. 몇천 개가 되면 언어별 파일로 나눠 받기
type Word = [string, string, string, string, string?];
const BOOK = WORDS as unknown as Record<string, Word[]>;
const keyOf = (code: string, w: Word) => `${code}:${w[0]}`;
// 주제 → 단어들. 주제 이름은 tt()로 번역해요
const TOPICS = TOPIC_DATA as Record<string, Record<string, string[]>>;
// 아는 단어 고르기를 한 번 지나갔다는 표시 (단어 키와 겹치지 않게 '#')
const startKey = (code: string) => `${code}#start`;
const EMOJI: Record<string, string> = {
  '일상·약속': '📅', '시간·약속': '⏰', '쇼핑·돈': '🛍️', '음식': '🍜', '여행·교통': '✈️', '회사·공부': '💼', '감정·생각': '💭',
  '건강': '💊', '자주 쓰는 표현': '💬', '장소': '📍', '사람': '👥', '날씨·건강': '🌦️', '취미·일': '🎨', '기본 동사·형용사': '🔤',
};

type Mode = 'learn' | 'review' | 'hard' | 'quick';
const NO_RUN = { code: '', ids: [], done: [], miss: [], knew: [] };

export function Vocab() {
  const { state, set } = useStore();
  const { speak, toast, openDialog, openSheet } = useUi();
  const codes = Object.keys(BOOK).filter((c) => c !== state.native);
  const [picked, setPicked] = useState(() => state.learn.find((c) => codes.includes(c)) ?? codes[0]);
  const code = codes.includes(picked) ? picked : codes[0];
  const words = BOOK[code];
  const keys = words.map((w) => keyOf(code, w));
  const topics = TOPICS[code] ?? {};
  const topic = topics[state.vocabTopic] ? state.vocabTopic : '';
  const inTopic = (i: number) => !topic || topics[topic].includes(words[i][0]);
  // 한 번에 10개씩. 새 단어는 무료 30개까지, 그다음은 프리미엄. 복습은 언제나 무료
  const left = freeLeft(state.vocabFree.n);
  // 고른 주제 먼저, 모자라면 다른 단어로 채워서 늘 10개씩
  const pickFrom = (log: typeof state.vocab) => {
    const q = pickSession(keys, log, Date.now(), SESSION, inTopic, left);
    if (!topic || q.length >= SESSION) return q;
    const usedNew = q.filter((i) => !log[keys[i]]).length;
    return [...q, ...pickSession(keys, log, Date.now(), SESSION - q.length, (i) => !inTopic(i), left - usedNew)];
  };
  const pick = () => pickFrom(state.vocab);
  // 하다 만 판이 있으면 거기서 이어서 (단어 목록이 바뀌었으면 버려요)
  const run = state.vocabRun;
  const live = run.code === code && run.done.length < run.ids.length && run.ids.every((i) => i < words.length);
  // 처음엔 수준 테스트, 그다음부터는 '지금 할 일' 카드가 있는 첫 화면
  const [view, setView] = useState<'pick' | 'study' | 'list'>(() => (!state.vocab[startKey(code)] ? 'pick' : 'list'));
  const [mode, setMode] = useState<Mode>('learn');
  const [queue, setQueue] = useState<number[]>(() => (live ? run.ids : pick()));
  // 첫 화면: 펼친 설정, 내 단어 필터, 전체 보기
  const [panel, setPanel] = useState(false); // 주제 고르기 펼침
  const [tab, setTab] = useState<'' | 'learning' | 'learned' | 'new' | 'off'>('');
  const [all, setAll] = useState(false);

  const now = Date.now();
  const ids = words.map((_, i) => i).filter(inTopic);
  const boxOf = (i: number) => state.vocab[keys[i]]?.[0] ?? 0;
  const hardIds = ids.filter((i) => boxOf(i) !== KNOWN && state.vocabStar.includes(keys[i]));
  const seenIds = ids.filter((i) => boxOf(i) && boxOf(i) !== KNOWN);
  const next = pick();
  const open = (m: Mode, q: number[]) => { setMode(m); setQueue(q); setView('study'); };
  const start = () => { set({ vocabRun: NO_RUN }); open('learn', pick()); };
  const toggle = (k: string) => set((s) => {
    const vocab = { ...s.vocab };
    if (vocab[k]?.[0] === KNOWN) delete vocab[k]; else vocab[k] = knownLog();
    return { vocab };
  });
  // 새로고침: 이 언어의 단어 기록만 지우고 처음부터 다시 배워요 (수준 테스트 표시·연속 기록은 남겨요)
  const reset = () => openDialog(tt('단어장을 새로 시작할까요?'), tt('{l} 단어의 공부 기록이 모두 지워지고 처음부터 다시 배워요. 되돌릴 수 없어요.', { l: langName(code) }), [
    { label: tt('취소'), kind: 'light' },
    { label: tt('새로 시작'), kind: 'danger', fn: () => {
      set((s) => {
        const vocab = { ...s.vocab };
        for (const k of keys) delete vocab[k];
        return { vocab, vocabStar: s.vocabStar.filter((k) => !keys.includes(k)), vocabRun: NO_RUN, vocabFree: { n: 0 } };
      });
      setTab(''); toast(tt('단어장을 새로 시작했어요'));
    } },
  ]);
  // 테스트용 '다음날': 시계를 바꾸는 대신 기록을 하루 앞당겨서, 내일 열었을 때처럼 보여요
  // shortcut: 테스트용 버튼이라 정식 공개 전에 빼기
  const nextDay = () => {
    set((s) => {
      const vocab = { ...s.vocab };
      for (const k of keys) if (vocab[k] && vocab[k][0] !== KNOWN) vocab[k] = [vocab[k][0], vocab[k][1] - 86400000];
      const back = (d: string) => { if (!d) return d; const [y, m, dd] = d.split('-').map(Number); return dayOf(new Date(y, m - 1, dd - 1).getTime()); };
      return { vocab, vocabDays: s.vocabDays.map(back) };
    });
    toast(tt('하루가 지났어요'));
  };
  const star = (k: string) => set((s) => ({ vocabStar: s.vocabStar.includes(k) ? s.vocabStar.filter((x) => x !== k) : [...s.vocabStar, k] }));
  const topicChips = Object.keys(topics).length > 0 && (
    <div className="vb-topics">
      <Chip on={!topic} onClick={() => set({ vocabTopic: '' })}><span aria-hidden>📚 </span>{tt('전체')}</Chip>
      {Object.keys(topics).map((t) => <Chip key={t} on={t === topic} onClick={() => set({ vocabTopic: t })}>{EMOJI[t] && <span aria-hidden>{EMOJI[t]} </span>}{tt(t)}</Chip>)}
    </div>
  );

  const openPremium = () => openSheet(<PremiumSheet />);
  // 무료 30개를 다 쓰고 새 단어가 남아 있으면 '10개 더 배우기'는 프리미엄으로
  const locked = !live && left === 0 && !next.length && ids.some((i) => !boxOf(i));
  const more = () => (locked ? openPremium() : start());

  if (view === 'pick') return (
    <section className="screen">
      <Placement code={code} words={words} keys={keys} chips={topicChips}
        onDone={(sel) => {
          const vocab = { ...state.vocab, [startKey(code)]: [0, Date.now()] as [number, number] };
          for (const k of sel) vocab[k] = knownLog();
          set({ vocab });
          // 고른 뒤 바로 학습으로
          const q = pickFrom(vocab);
          setMode('learn'); setQueue(q); setView(q.length ? 'study' : 'list');
        }} />
    </section>
  );

  if (view === 'study' && queue.length) return (
    <section className="screen">
      <Session key={mode + queue.join()} code={code} ids={queue} mode={mode} run={mode === 'learn' && live && run.ids.join() === queue.join() ? run : undefined}
        onList={() => setView('list')} onMore={more} more={next.length > 0 || left === 0} />
    </section>
  );

  // 첫 화면은 '지금 할 일' 카드 하나가 주인공. 나머지는 아래에 작게
  const today = todayCount(state.vocab, now);
  const fresh = next.filter((i) => !boxOf(i)).length, review = next.length - fresh;
  const mins = (n: number) => Math.max(1, Math.round(n / 3));
  const tomorrow = new Date(now).setHours(48, 0, 0, 0);
  const dueSoon = ids.filter((i) => boxOf(i) && boxOf(i) !== KNOWN && state.vocab[keys[i]][1] < tomorrow).length;
  const firstTime = !seenIds.length;
  const streak = dayStreak(state.vocabDays, now), week = weekOf(state.vocabDays, now), wd = (new Date(now).getDay() + 6) % 7;
  const allDone = !live && !next.length && !locked;
  const hero = live
    ? { label: tt('아까 하던 학습'), title: `${tt('이어서 하기')} · ${run.done.length} / ${run.ids.length}`, sub: tt('{n}개 남았어요 · 약 {m}분', { n: run.ids.length - run.done.length, m: mins(run.ids.length - run.done.length) }), btn: tt('이어서 하기'), go: () => open('learn', run.ids) }
    : locked
      ? { label: `${tt('무료 단어 {n}개 완료', { n: FREE_WORDS })} 🎉`, title: tt('{n}개 더 배우기는 프리미엄으로', { n: SESSION }), sub: tt('배운 단어 복습은 언제나 무료예요'), btn: tt('{n}개 더 배우기', { n: SESSION }), go: openPremium }
      : allDone
        ? { label: `${tt('오늘 목표 달성')} 🎉`, title: tt('오늘 할 단어를 다 했어요'), sub: dueSoon ? tt('내일 복습 {n}개도 기다려요', { n: dueSoon }) : '', btn: '', go: start }
        : !fresh
          ? { label: tt('오늘 할 일'), title: tt('복습 {n}개 하기', { n: review }), sub: tt('헷갈렸던 단어예요 · 약 {m}분', { m: mins(review) }), btn: tt('복습 시작'), go: start }
          : { label: firstTime ? tt('첫 학습') : today ? tt('잘하고 있어요') : tt('오늘 할 일'),
              title: firstTime ? tt('첫 단어 {n}개 배우기', { n: next.length }) : today ? tt('이어서 {n}개 더 배우기', { n: next.length }) : tt('단어 {n}개 배우기', { n: next.length }),
              sub: (review ? tt('복습 {a}개 + 새 단어 {b}개', { a: review, b: fresh }) : tt('새 단어 {n}개', { n: fresh })) + ' · ' + tt('약 {m}분', { m: mins(next.length) }),
              btn: today && !firstTime ? tt('{n}개 더 배우기', { n: next.length }) : tt('시작하기'), go: start };
  const learnedFree = Math.min(state.vocabFree.n, FREE_WORDS);
  // 내 단어장: 공부 중(1~3칸) / 외운 단어(4~5칸) / 아직 안 배운 단어 / 뺀 단어
  const group = (i: number) => { const b = boxOf(i); return b === KNOWN ? 'off' : !b ? 'new' : b >= 4 ? 'learned' : 'learning'; };
  const groups = { learning: 0, learned: 0, new: 0, off: 0 };
  ids.forEach((i) => groups[group(i)]++);
  const curTab = tab || (groups.learning ? 'learning' : 'new');
  const shownIds = ids.filter((i) => group(i) === curTab);
  const visible = all ? shownIds : shownIds.slice(0, 5);
  const studied = groups.learning + groups.learned;
  const startToday = new Date(now).setHours(0, 0, 0, 0);
  const when = (i: number) => {
    const d = Math.round((state.vocab[keys[i]][1] - startToday) / 86400000);
    return d <= 0 ? tt('오늘 복습') : d === 1 ? tt('내일 복습') : tt('{n}일 뒤 복습', { n: d });
  };
  const doneToday = state.vocabDays.includes(dayOf(now));

  return (
    <section className="screen">
      <div className="page vb">
        <div className="vb-top-row">
          <h1>{tt('단어장')}</h1>
          {codes.length > 1 && (
            <label className="vb-lang">
              <select value={code} onChange={(e) => setPicked(e.target.value)} aria-label={tt('배울 언어')}>
                {codes.map((c) => <option key={c} value={c}>{langName(c)}</option>)}
              </select>
              <span aria-hidden>{langName(code)} ▾</span>
            </label>
          )}
        </div>
        <div className="vb-hero">
          <small>{hero.label}</small>
          <h2>{hero.title}</h2>
          {hero.sub && <p>{hero.sub}</p>}
          {locked && (
            <ul className="vb-hero-perks">
              {['새 단어 제한 없이', 'AI 전화 무제한', '광고 없이 공부만'].map((x) => <li key={x}>✓ {tt(x)}</li>)}
            </ul>
          )}
          {!live && !locked && !allDone && (
            <div className="vb-hero-bar"><i style={{ width: `${(learnedFree / FREE_WORDS) * 100}%` }} /><small>{left ? tt('무료 단어 {a}개 중 {b}개 배웠어요', { a: FREE_WORDS, b: learnedFree }) : tt('무료 단어를 다 배웠어요 · 복습은 무료예요')}</small></div>
          )}
          {hero.btn && <button className="vb-hero-btn" onClick={hero.go}>{locked && <Sparkle />}{hero.btn}</button>}
          {locked && <small className="vb-hero-note">{tt('첫 달 4,950원 · 언제든 해지')}</small>}
          {live && <button className="vb-hero-link" onClick={start}>{tt('처음부터 다시')}</button>}
          {!live && !locked && Object.keys(topics).length > 0 && (
            <div className="vb-hero-opts">
              <button aria-expanded={panel} onClick={() => setPanel(!panel)}>{topic ? EMOJI[topic] ?? '' : '📚'} {tt('주제')}: {topic ? tt(topic) : tt('전체')} ▾</button>
            </div>
          )}
          {panel && !live && !locked && topicChips}
          {!locked && (
            <button className="vb-hero-pro" onClick={openPremium}>
              <Sparkle /><span>{tt('새 단어를 제한 없이 배우고 싶다면')}</span><b>{tt('프리미엄')} ›</b>
            </button>
          )}
        </div>

        <div className="my-card vb-streak">
          <div className="vb-streak-top">
            <span className="fire" aria-hidden>🔥</span>
            <div>
              <b>{streak > 0 ? tt('{n}일 연속 공부 중', { n: streak }) : tt('연속 기록을 시작해 봐요')}</b>
              <small>{doneToday ? tt('오늘 공부 완료! 내일도 하면 {n}일 연속', { n: streak + 1 }) : streak > 0 ? tt('오늘 공부하면 {n}일 연속이 돼요', { n: streak + 1 }) : tt('오늘 단어를 공부하면 1일째예요')}</small>
            </div>
          </div>
          <div className="vb-week2" aria-label={tt('이번 주 공부한 날')}>
            {['월', '화', '수', '목', '금', '토', '일'].map((d, k) => (
              <span key={d} className={week[k] ? 'on' : k === wd ? 'today' : k > wd ? 'later' : 'miss'}>
                <i>{week[k] ? '✓' : ''}</i><small>{k === wd ? tt('오늘') : tt(d)}</small>
              </span>
            ))}
          </div>
        </div>

        <h2 className="vb-h2">{tt('더 하고 싶을 때')}</h2>
        <div className="vb-more-card">
              <button onClick={openPremium}>
                <span className="ic pro" aria-hidden><Sparkle /></span>
                <span><b>{tt('새 단어 무제한으로 배우기')}</b><small>{tt('프리미엄 · 무료 {n}개 제한 없이', { n: FREE_WORDS })}</small></span>
                <em className="vb-pill">{tt('첫 달 50%')}</em>
              </button>
              {hardIds.length > 0 && (
                <button onClick={() => open('hard', hardIds.slice(0, SESSION))}>
                  <span className="ic hard" aria-hidden>★</span>
                  <span><b>{tt('어려운 단어 {n}개', { n: hardIds.length })}</b><small>{tt('틀렸던 단어만 다시 써 보기')}</small></span>
                  <Icon name="chev" />
                </button>
              )}
              {seenIds.length >= 4 && (
                <button onClick={() => open('quick', shuffle(seenIds).slice(0, 10))}>
                  <span className="ic" aria-hidden>⚡</span>
                  <span><b>{tt('빠른 복습')}</b><small>{tt('뜻 고르기 10개 · 1분')}</small></span>
                  <Icon name="chev" />
                </button>
              )}
        </div>

        <h2 className="vb-h2">{tt('내 단어장')}</h2>
        <div className="my-card vb-sum">
          <p>{tt('{a}개 중 {b}개 공부했어요', { a: ids.length - groups.off, b: studied })}</p>
          <div className="vb-bar"><i className="all" style={{ width: `${(studied / Math.max(1, ids.length - groups.off)) * 100}%` }} /></div>
        </div>
        <div className="vb-tabs" role="tablist">
          {([['learning', '공부 중'], ['learned', '외운 단어'], ['new', '안 배운 단어'], ['off', '뺀 단어']] as const).map(([k, l]) => (k !== 'off' || groups.off > 0) && (
            <button key={k} role="tab" aria-selected={curTab === k} className={curTab === k ? 'on' : ''} onClick={() => { setTab(k); setAll(false); }}>{tt(l)}<b>{groups[k]}</b></button>
          ))}
        </div>
        <p className="vb-tab-note">{tt(({ learning: '복습 날짜가 되면 다시 나와요', learned: '여러 번 맞혀서 잘 아는 단어예요', new: '앞으로 배울 단어예요. 이미 알면 ‘알아요’를 눌러요', off: '안 배우기로 한 단어예요' } as const)[curTab])}</p>
        <ul className="vb-list my-card">
          {visible.map((i) => {
            const w = words[i], starred = state.vocabStar.includes(keys[i]);
            const due = curTab === 'learning' || curTab === 'learned' ? when(i) : '';
            return (
              <li key={w[0]}>
                <button onClick={() => speak(w[0], code)} aria-label={`${w[0]} ${tt('듣기')}`}>
                  <span><b lang={langTag(code)}>{w[0]}</b><small>{w[1]}</small></span>
                  {due && <em className={`vb-due${due === tt('오늘 복습') ? ' now' : ''}`}>{due}</em>}
                </button>
                {due && <button className={`vb-star${starred ? ' on' : ''}`} aria-label={tt('어려운 단어')} aria-pressed={starred} onClick={() => star(keys[i])}>{starred ? '★' : '☆'}</button>}
                {curTab === 'new' && <button className="vb-x" onClick={() => toggle(keys[i])}>{tt('알아요')}</button>}
                {curTab === 'off' && <button className="vb-x" onClick={() => toggle(keys[i])}>{tt('되돌리기')}</button>}
              </li>
            );
          })}
          {!visible.length && <li className="vb-empty">{curTab === 'learning' ? tt('아직 공부한 단어가 없어요') : curTab === 'learned' ? tt('조금만 더 하면 여기에 모여요') : tt('여기에 맞는 단어가 없어요')}</li>}
        </ul>
        {shownIds.length > 5 && <button className="vb-all" onClick={() => setAll(!all)}>{all ? tt('접기') : tt('단어 {n}개 더 보기', { n: shownIds.length - 5 })} {all ? '▴' : '▾'}</button>}
        <div className="vb-retest">
          <small>{tt('실력이 바뀌었나요?')}</small>
          <button onClick={() => setView('pick')}>{tt('수준 테스트 다시 하기')}</button>
          <button className="vb-reset" onClick={reset}>↻ {tt('단어장 새로고침')}</button>
          <button className="vb-reset" onClick={nextDay}>☀ {tt('다음날로 넘기기 (테스트)')}</button>
        </div>
      </div>
    </section>
  );
}

/** 결과 화면: 맞힌 수 · 걸린 시간 · 연속, 이번 주 7칸 */
function Report({ right, ms }: { right: number; ms: number }) {
  const { state } = useStore();
  const now = Date.now(), week = weekOf(state.vocabDays, now), today = (new Date(now).getDay() + 6) % 7;
  const min = Math.round(ms / 60000);
  return (
    <div className="vb-report">
      <div className="vb-stats">
        <span><b>{right}</b><small>{tt('맞힌 단어')}</small></span>
        <span><b>{min ? tt('{n}분', { n: min }) : tt('{n}초', { n: Math.max(1, Math.round(ms / 1000)) })}</b><small>{tt('걸린 시간')}</small></span>
        <span><b>{tt('{n}일', { n: dayStreak(state.vocabDays, now) })}</b><small>{tt('연속')}</small></span>
      </div>
      <div className="vb-week" aria-label={tt('이번 주')}>
        {['월', '화', '수', '목', '금', '토', '일'].map((d, k) => <span key={d} className={(week[k] ? 'on' : '') + (k === today ? ' now' : '')}><i>{week[k] ? '🔥' : ''}</i><small>{tt(d)}</small></span>)}
      </div>
    </div>
  );
}

/** 프리미엄 표시: 알록달록한 네 갈래 반짝이 */
const Sparkle = () => (
  <svg className="vb-sparkle" viewBox="0 0 24 24" aria-hidden>
    <defs><linearGradient id="vb-sp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#00b8ff" /><stop offset=".38" stopColor="#7b3dff" /><stop offset=".68" stopColor="#ff2bd6" /><stop offset="1" stopColor="#ffc400" /></linearGradient></defs>
    <path fill="url(#vb-sp)" d="M12 0c.6 6.3 5.7 11.4 12 12-6.3.6-11.4 5.7-12 12-.6-6.3-5.7-11.4-12-12C6.3 11.4 11.4 6.3 12 0z" />
  </svg>
);

/** 프리미엄 안내 시트: 어디서 눌러도 같은 시트 (Figma 679:1141 C) */
function PremiumSheet() {
  const { toast, closeLayer } = useUi();
  return (
    <div className="pm">
      <div className="pm-head"><Sparkle /><h2>{tt('프리미엄으로 제한 없이')}</h2><p>{tt('새 단어도, AI 전화도 마음껏')}</p></div>
      <div className="pm-card">
        <div className="pm-top"><b>{tt('월간 프리미엄')}</b><em className="vb-pill">{tt('첫 달 50% 할인')}</em></div>
        <ul>{['새 단어 제한 없이', 'AI 전화 하루 3번 제한 없이', '쇼츠 영상 전체 열기 · 광고 없음'].map((x) => <li key={x}>✓ {tt(x)}</li>)}</ul>
        <div className="pm-price"><span><s>9,900원</s><b>4,950</b><small>{tt('원 / 첫 달')}</small></span><small>{tt('다음 달부터 9,900원')}</small></div>
      </div>
      {/* shortcut: 결제가 아직 없어서 안내만. 결제 붙일 때 여기서 시작 */}
      <button className="vb-hero-btn" onClick={() => { closeLayer(); toast(tt('프리미엄은 준비 중이에요')); }}>{tt('프리미엄 시작하기')}</button>
      <button className="pm-later" onClick={closeLayer}>{tt('언제든 해지할 수 있어요 · 나중에 할게요')}</button>
    </div>
  );
}

const shuffle = <T,>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

/** 수준 테스트 (말해보카처럼): 단어 20개의 뜻을 빠르게 고르고, 맞힌 단어는 아는 단어로 빼요 */
function Placement({ code, words, keys, chips, onDone }: { code: string; words: Word[]; keys: string[]; chips: ReactNode; onDone: (sel: string[]) => void }) {
  const { state } = useStore();
  const { speak } = useUi();
  const [ids] = useState(() => placementIds(keys, state.vocab));
  const [at, setAt] = useState(0);
  const [right, setRight] = useState<string[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const i = ids[at];
  const w = i === undefined ? undefined : words[i];
  // 보기 4개: 정답 + 다른 단어 뜻 3개
  const [opts, setOpts] = useState<number[]>([]);
  useEffect(() => {
    if (i === undefined) return;
    setOpts(shuffle([i, ...shuffle(words.map((_, k) => k).filter((k) => k !== i)).slice(0, 3)]));
    speak(words[i][0], code, { quiet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  const choose = (k: number | null) => {
    if (picked !== null || i === undefined) return;
    setPicked(k ?? -1);
    if (k === i) setRight((r) => [...r, keys[i]]);
    // 누르면 잠깐 정답만 보여 주고 저절로 다음
    setTimeout(() => { setPicked(null); setAt((a) => a + 1); }, k === i ? 450 : 900);
  };

  const story = (
    <div className="vb-head">
      <div className="vb-story">{ids.map((x, k) => <i key={x} className={k < at ? 'on' : k === at ? 'now' : ''} />)}</div>
      {w && <button onClick={() => onDone(right)}>{tt('건너뛰기')}</button>}
    </div>
  );

  if (!w) return (
    <div className="vb-session vb-pick">
      {story}
      <div className="vb-body vb-end">
        <span className="vb-trophy"><Icon name="check" /></span>
        <h2>{tt('{n}개를 이미 알고 있어요', { n: right.length })}</h2>
        <p>{tt('아는 단어는 빼고, 모르는 단어부터 배워요. 배우고 싶은 주제도 골라 보세요.')}</p>
        {chips}
        <div className="vb-foot"><Button kind="dark" style={{ minHeight: 49, padding: '14px 16px' }} onClick={() => onDone(right)}>{tt('학습 시작')}</Button></div>
      </div>
    </div>
  );

  return (
    <div className="vb-session vb-pick">
      {story}
      <div className="vb-body vb-test">
        <span className="rc-chip">{tt('수준 테스트')} · {langName(code)}</span>
        <button className="vb-word" onClick={() => speak(w[0], code)}><b lang={langTag(code)}>{w[0]}</b><Icon name="speak" /></button>
        <p className="vb-q">{tt('알맞은 뜻을 골라 보세요')}</p>
        <div className="vb-opts">
          {opts.map((k) => (
            <button key={k} disabled={picked !== null} onClick={() => choose(k)}
              className={picked === null ? '' : k === i ? 'ok' : k === picked ? 'no' : ''}>{words[k][1]}</button>
          ))}
        </div>
        <div className="vb-foot"><Button kind="link" onClick={() => choose(null)}>{tt('몰라요')}</Button></div>
      </div>
    </div>
  );
}

const SPEEDS = [1, 0.8, 0.6];

/** 내 답: 틀린 글자는 빨강, 빠진 자리는 ‸ */
function Mine({ text, ops }: { text: string; ops: Op[] }) {
  const c = [...text], out: ReactNode[] = [];
  for (let i = 0; i <= c.length; i++) {
    if (ops.some((o) => o.k === 'miss' && o.t === i)) out.push(<i key={`m${i}`} className="gap">‸</i>);
    if (i < c.length) out.push(ops.some((o) => o.k !== 'miss' && o.t === i) ? <i key={i} className="bad">{c[i]}</i> : c[i]);
  }
  return <>{out}</>;
}
/** 정답: 고쳐야 하는 글자에 초록 밑줄 */
const Right = ({ text, ops }: { text: string; ops: Op[] }) => <>{[...text].map((ch, j) => (ops.some((o) => o.k !== 'extra' && o.a === j) ? <i key={j} className="fix">{ch}</i> : ch))}</>;

/** 틀린 이유 한 줄 */
function reason(kind: string, ops: Op[], typed: string, ans: string, w: Word) {
  if (kind === 'form') return [tt('단어는 맞지만 모양이 달라요'), tt('이 문장에서는 ‘{a}’로 써요. 기본형은 ‘{b}’예요.', { a: ans, b: w[0] })];
  if (kind === 'short') return [tt('글자가 모자라요'), tt('‘{t}’까지는 맞아요. 뒤에 {n}글자가 더 있어요.', { t: typed, n: [...ans].length - [...typed].length })];
  if (kind === 'long') return [tt('글자가 더 많아요'), tt('‘{a}’까지만 쓰면 돼요.', { a: ans })];
  if (kind === 'other') return [tt('다른 단어예요'), tt('이 자리에는 ‘{m}’라는 뜻의 단어가 들어가요.', { m: w[1] })];
  const o = ops[0], t = [...typed], a = [...ans];
  const one = ops.length !== 1 ? ''
    : o.k === 'miss' ? tt('‘{c}’ 글자를 하나 빠뜨렸어요.', { c: a[o.a] })
    : o.k === 'extra' ? tt('‘{c}’ 글자가 하나 더 들어갔어요.', { c: t[o.t] })
    : tt('‘{a}’ 자리에 ‘{b}’ 글자를 썼어요.', { a: a[o.a], b: t[o.t] });
  return [tt('철자가 {n}글자 달라요', { n: ops.length }), one];
}

// 한 판에 단어 20개, 단어마다 빈칸 한 번. 틀린 단어는 다 맞힐 때까지 다음 판으로 이어서
type Run = AppState['vocabRun'];
const TITLE: Record<Mode, string> = { learn: '단어 빈칸', review: '복습', hard: '어려운 단어', quick: '빠른 복습' };

/** 뜻 고르기 보기 4개: 같은 주제 단어에서 골라 헷갈리게 */
function optionsFor(code: string, i: number) {
  const words = BOOK[code], same = Object.values(TOPICS[code] ?? {}).find((t) => t.includes(words[i][0])) ?? [];
  const near = shuffle(words.map((_, k) => k).filter((k) => k !== i && same.includes(words[k][0])));
  const rest = shuffle(words.map((_, k) => k).filter((k) => k !== i && !near.includes(k)));
  return shuffle([i, ...[...near, ...rest].slice(0, 3)]);
}

// 한 판에 하루 양만큼, 단어마다 빈칸 한 번. 틀린 단어는 다 맞힐 때까지 다음 판으로 이어서
function Session({ code, ids, run, mode, onList, onMore, more }: { code: string; ids: number[]; run?: Run; mode: Mode; onList: () => void; onMore: () => void; more: boolean }) {
  const { state, set } = useStore();
  const { speak, go: goTo } = useUi();
  const words = BOOK[code];
  const quick = mode === 'quick';
  const say = (t: string) => { if (!state.vocabMute) speak(t, code, { quiet: true }); };
  const [t0] = useState(Date.now);
  const [round, setRound] = useState(1);
  const [list, setList] = useState(ids);
  const [steps, setSteps] = useState<Step[]>(() => (quick ? ids.map((w): Step => ({ w, kind: 'choose' }))
    : buildSteps(ids.filter((i) => !run?.done.includes(i)), (i) => state.vocab[keyOf(code, words[i])]?.[0] ?? 0)));
  const [at, setAt] = useState(0);
  const [done, setDone] = useState<number[]>(run?.done ?? []);
  const [miss, setMiss] = useState<number[]>(run?.miss ?? []);
  const [knew, setKnew] = useState<number[]>(run?.knew ?? []); // '이미 알아요'로 뺀 단어 (맞힌 수에 안 셈)
  // ok: 맞힘, wrong: 틀림, shown: 정답 봄. 셋 다 그 단어는 끝
  const [result, setResult] = useState<'ok' | 'wrong' | 'shown'>();
  const [hint, setHint] = useState(false);
  const [text, setText] = useState('');
  const [opts, setOpts] = useState<number[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [knewIt, setKnewIt] = useState<number[]>([]); // 문제로 바로 맞힌 새 단어 (이미 알던 단어)
  const [newly, setNewly] = useState<number[]>([]); // 틀리거나 몰라서 카드로 배운 새 단어
  const step = steps[at] as Step | undefined;
  const w = step ? words[step.w] : undefined;
  const k = w ? keyOf(code, w) : '';
  const en = code === 'en';

  const gap = w ? cloze(w[2], w[4] ?? w[0], en) ?? ['', w[0], ''] : null;
  const ans = gap?.[1] ?? '';

  useEffect(() => {
    if (!w) return;
    if (step!.kind === 'choose') setOpts(optionsFor(code, step!.w));
    // 단어 카드와 고르기 문제에서 단어를 한 번 읽어 줘요
    if (step!.kind !== 'cloze') say(w[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, round]);

  // 첫 판은 단어마다 저장해서, 나갔다 와도 이어서 해요. 다 풀면 지워요
  useEffect(() => {
    if (round !== 1 || mode !== 'learn') return;
    set({ vocabRun: done.length < list.length ? { code, ids: list, done, miss, knew } : NO_RUN });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done.length, round]);

  const advance = (n: number) => {
    // 한 바퀴 다 돌면, 카드로 배운 단어만 고르기 → 쓰기로 한 번 더
    if (mode === 'learn' && n >= steps.length && newly.length && !steps.some((x) => x.again))
      setSteps((st) => [...st, ...newly.map((w): Step => ({ w, kind: 'choose', again: true })), ...newly.map((w): Step => ({ w, kind: 'cloze', again: true }))]);
    setAt(n); setResult(undefined); setHint(false); setText(''); setChosen(null);
  };
  const go = () => advance(at + 1);
  const cardNext = (wi: number) => setSteps((st) => [...st.slice(0, at + 1), { w: wi, kind: 'intro' }, ...st.slice(at + 1)]);
  const markDay = () => set((s) => (s.vocabDays.includes(dayOf(Date.now())) ? {} : { vocabDays: [...s.vocabDays.slice(-400), dayOf(Date.now())] }));

  const end = (r: 'ok' | 'wrong' | 'shown' | 'skip' | 'known') => {
    if (!step || !w || result) return;
    if (r === 'known') {
      // '이미 알아요'도 새 단어 하나를 본 거라 무료 30개에서 세요
      set((s) => ({ vocab: { ...s.vocab, [k]: knownLog() }, vocabFree: s.vocab[k] ? s.vocabFree : { n: s.vocabFree.n + 1 } }));
      setDone((d) => [...d, step.w]); setKnew((x) => [...x, step.w]);
      // 보기·고르기 화면이면 뒤의 문제도 건너뛰어요
      let n = at + 1;
      while (steps[n]?.w === step.w) n++;
      advance(n);
      return;
    }
    const missed = r !== 'ok' || hint;
    if (!step.again) setDone((d) => [...d, step.w]);
    if (missed) setMiss((m) => [...m, step.w]);
    markDay();
    // 첫 판은 맞힘·틀림 모두 기록, 다시 하는 판은 이미 1칸이라 그대로
    set((s) => {
      const box = nextBox(s.vocab[k]?.[0] ?? 0, missed);
      // 처음 배우는 단어면 무료 한도에서 하나 써요
      const vocabFree = s.vocab[k] ? s.vocabFree : { n: s.vocabFree.n + 1 };
      const vocab = (round === 1 && !step.again) || missed ? { ...s.vocab, [k]: [box, dueAt(box, Date.now())] as [number, number] } : s.vocab;
      // 틀리면 어려운 단어에 담고, 어려운 단어 복습에서 맞히면 빼요
      const has = s.vocabStar.includes(k);
      const vocabStar = r === 'wrong' && !has ? [...s.vocabStar, k] : mode === 'hard' && !missed ? s.vocabStar.filter((x) => x !== k) : s.vocabStar;
      return { vocab, vocabStar, vocabFree };
    });
    if (r === 'skip') return go();
    setResult(r);
    say(w[2]);
  };

  const choose = (c: number) => {
    if (!step || chosen !== null) return;
    setChosen(c);
    const right = c === step.w;
    if (right) say(w![0]);
    if (!quick && step.again && !right) cardNext(step.w);
    // 새 단어 첫 문제: 맞히면 '이미 알던 단어'(2칸), 틀리거나 몰라요면 카드로 배우고(1칸) 뒤에서 다시
    if (!quick && !step.again) {
      setDone((d) => [...d, step.w]);
      markDay();
      set((s) => {
        const box = right ? 2 : 1;
        const has = s.vocabStar.includes(k);
        return {
          vocab: { ...s.vocab, [k]: [box, dueAt(box, Date.now())] as [number, number] },
          vocabFree: s.vocab[k] ? s.vocabFree : { n: s.vocabFree.n + 1 },
          vocabStar: !right && !has ? [...s.vocabStar, k] : s.vocabStar,
        };
      });
      if (right) setKnewIt((x) => [...x, step.w]);
      else { setNewly((x) => [...x, step.w]); cardNext(step.w); }
    }
    // 빠른 복습은 고르기가 곧 문제예요 (기록은 바꾸지 않아요)
    if (quick) { setDone((d) => [...d, step.w]); if (c !== step.w) setMiss((m) => [...m, step.w]); markDay(); }
  };

  const same = (a: string) => a.trim().toLowerCase().replace(/\s+/g, ' ');
  const check = () => { if (text.trim() && !result) end(same(text) === same(ans) ? 'ok' : 'wrong'); };
  const again = () => { setRound((r) => r + 1); setList(miss); setSteps(miss.map((w): Step => ({ w, kind: quick ? 'choose' : 'cloze' }))); setAt(0); setDone([]); setMiss([]); setKnew([]); };
  const starred = state.vocabStar.includes(k);
  const big = { minHeight: 49, padding: '14px 16px' };

  // 인스타그램 스토리처럼 단어마다 한 칸
  const prog = (
    <div className="vb-head">
      <div className="vb-story" role="progressbar" aria-valuenow={done.length} aria-valuemax={list.length}>
        {list.map((x) => <i key={x} className={done.includes(x) ? 'on' : step?.w === x ? 'now' : ''} />)}
      </div>
      {w && <button className={`vb-star${starred ? ' on' : ''}`} aria-label={tt('어려운 단어')} aria-pressed={starred}
        onClick={() => set((s) => ({ vocabStar: starred ? s.vocabStar.filter((x) => x !== k) : [...s.vocabStar, k] }))}>{starred ? '★' : '☆'}</button>}
      <button className={`vb-mute${state.vocabMute ? ' on' : ''}`} aria-pressed={state.vocabMute} onClick={() => set({ vocabMute: !state.vocabMute })}
        aria-label={tt('소리 없이')}><Icon name="speak" />{state.vocabMute && <i aria-hidden />}</button>
      <button onClick={onList}>{tt('목록')}</button>
    </div>
  );

  if (!step || !w) {
    const right = list.length - miss.length - knew.length;
    const all = round === 1 ? right : list.length - knew.length;
    return (
      <div className="vb-session">
        {prog}
        <div className="vb-body vb-end">
          {miss.length ? (
            <>
              <h2>{right ? tt('{n}개 맞혔어요', { n: right }) : tt('한 번 더 해 봐요')}</h2>
              <p>{tt('헷갈린 단어를 바로 이어서 연습해요')}</p>
              <div className="vb-foot"><Button style={big} onClick={again}>{tt('이어서 공부하기')}</Button></div>
            </>
          ) : (
            <>
              <span className="vb-trophy"><Icon name="check" /></span>
              <h2>{mode === 'learn' && (knewIt.length || newly.length) ? tt('{n}개 끝!', { n: list.length }) : all > 0 ? tt('{n}개 모두 맞혔어요!', { n: all }) : tt('다 끝났어요!')}</h2>
              {mode === 'learn' && (knewIt.length > 0 || newly.length > 0) && <p>{tt('이미 알던 단어 {a}개 · 새로 배운 단어 {b}개', { a: knewIt.length, b: newly.length })}</p>}
              <Report right={mode === 'learn' && newly.length ? knewIt.length : all} ms={Date.now() - t0} />
              {mode === 'learn' && (
                <div className="vb-more">
                  <small>{tt('원하면 이어서')}</small>
                  <button onClick={() => goTo('feed')}>{tt('문장 카드에서 써 보기')}<Icon name="chev" /></button>
                  <button onClick={() => goTo('call')}>{tt('AI 전화에서 써 보기')}<Icon name="chev" /></button>
                </div>
              )}
              <div className="vb-foot">
                {mode === 'learn' && more && <Button style={big} onClick={onMore}>{tt('이어서 {n}개 더 배우기', { n: SESSION })}</Button>}
                <Button kind={mode === 'learn' && more ? 'link' : 'dark'} style={mode === 'learn' && more ? undefined : big} onClick={onList}>{tt('단어장으로')}</Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // 틀리거나 몰라요를 누른 뒤에만 나오는 단어 카드
  if (step.kind === 'intro') return (
    <div className="vb-session">
      {prog}
      <div className="vb-body">
        <small className="vb-q">{tt('새로 배워요')}</small>
        <button className="vb-word" onClick={() => speak(w[0], code)}><b lang={langTag(code)}>{w[0]}</b><Icon name="speak" /></button>
        <p className="vb-mean">{w[1]}</p>
        <button className="vb-ex" onClick={() => speak(w[2], code)}><b lang={langTag(code)}>{w[2]}</b><small>{w[3]}</small></button>
        <p className="vb-later">{step.again ? tt('조금 뒤에 써 보면서 한 번 더 익혀요') : tt('이 단어는 조금 뒤에 한 번 더 나와요')}</p>
        <div className="vb-foot"><Button kind="dark" style={big} onClick={go}>{tt('외웠어요')}</Button></div>
      </div>
    </div>
  );

  if (step.kind === 'choose') return (
    <div className="vb-session">
      {prog}
      <div className="vb-body vb-test">
        {chosen === null
          ? <span className="rc-chip">{quick ? tt('빠른 복습') : step.again ? tt('다시 한 번') : tt('단어')} · {langName(code)}</span>
          : <b className={`vb-verdict${chosen === step.w ? ' ok' : ''}`}>{chosen === step.w ? (step.again || quick ? tt('정답이에요!') : `✓ ${tt('알고 있었네요!')}`) : tt('괜찮아요, 지금 배워요')}</b>}
        <button className="vb-word" onClick={() => speak(w[0], code)}><b lang={langTag(code)}>{w[0]}</b><Icon name="speak" /></button>
        {!quick && gap && <p className="vb-in" lang={langTag(code)}>{gap[0]}<mark>{gap[1]}</mark>{gap[2]}</p>}
        <p className="vb-q">{tt('알맞은 뜻은?')}</p>
        <div className="vb-opts">
          {opts.map((o) => (
            <button key={o} disabled={chosen !== null} onClick={() => choose(o)}
              className={chosen === null ? '' : o === step.w ? 'ok' : o === chosen ? 'no' : ''}>
              {chosen !== null && o === step.w && <span aria-label={tt('정답')}>✓ </span>}
              {chosen !== null && o === chosen && o !== step.w && <span aria-label={tt('내 답')}>✕ </span>}
              {words[o][1]}
            </button>
          ))}
        </div>
        <div className="vb-foot">
          {chosen !== null
            ? <Button kind="dark" style={big} onClick={go}>{chosen === step.w || quick ? tt('다음') : tt('배우기')}</Button>
            : <Button kind="link" onClick={() => choose(-1)}>{tt('몰라요')}</Button>}
        </div>
      </div>
    </div>
  );

  const typed = text.trim();
  const fault = result === 'wrong' ? why(typed, ans, w[0]) : null;
  const [title, detail] = fault ? reason(fault.kind, fault.ops, typed, ans, w) : ['', ''];
  const marks = fault && fault.kind !== 'other' ? fault.ops : [];

  return (
    <div className="vb-session">
      {prog}
      <div className="vb-body">
        <div className={`rcard ex vb-card${result ? ' ' + result : ''}`}>
          {result ? (
            <div className="vb-res">
              <span className="ic">{result === 'ok' ? <Icon name="check" /> : '!'}</span>
              <b>{result === 'ok' ? tt('정답이에요!') : tt('괜찮아요, 다음에 또 나와요')}</b>
            </div>
          ) : <span className="rc-chip">{step.again ? tt('써 보기 · 틀렸던 단어만') : tt(TITLE[mode])} · {langName(code)}</span>}
          <form onSubmit={(e) => { e.preventDefault(); check(); }}>
            <p className="rc-s" lang={langTag(code)}>
              {gap![0]}
              <span className="vb-slot">
                <span className={`ex-blank${result === 'ok' ? ' ok' : result === 'wrong' ? ' no shake' : result === 'shown' ? ' show' : hint ? ' hinted' : ''}`}>
                  {result === 'ok' || result === 'shown' ? ans : result === 'wrong' ? typed : (
                    <input key={at} autoFocus value={text} onChange={(e) => { setText(e.target.value); if (same(e.target.value) === same(ans)) end('ok'); }}
                      style={{ width: `${(Math.max([...ans].length, [...text].length) + 1) * (en ? 0.8 : 1.4)}ch` }}
                      placeholder={hint ? hintShape(ans) : '·'.repeat([...ans].length)}
                      aria-label={tt('빈칸을 채워 보세요')} enterKeyHint="done"
                      autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} />
                  )}
                </span>
                {/* 기본형은 답을 거의 알려 줘서 풀기 전에는 숨기고, 답을 본 뒤에만 보여 줘요 */}
                {hint && !result && <small>{tt('{n}글자', { n: [...ans].length })}</small>}
              </span>
              {gap![2]}
            </p>
          </form>
          <p className="rc-tr">{w[3]}</p>
          {result === 'ok' && <p className="vb-meanline" lang={langTag(code)}>{ans} = {w[1]}{ans !== w[0] ? ` · ${tt('기본형')} ${w[0]}` : ''}</p>}

          {fault && (
            <div className="vb-why" role="alert">
              <b>{title}</b>
              <div className="vb-row"><small>✕ {tt('내 답')}</small><span lang={langTag(code)}><Mine text={typed} ops={marks} /></span></div>
              <div className="vb-row right"><small>✓ {tt('정답')}</small><span lang={langTag(code)}><Right text={ans} ops={marks} /></span></div>
              {detail && <p>{detail}</p>}
              <p className="mean">{ans} = {w[1]}{ans !== w[0] && fault.kind !== 'form' ? ` · ${tt('기본형')} ${w[0]}` : ''}</p>
              <p className="saved">★ {tt('어려운 단어에 담았어요')}</p>
            </div>
          )}
          {result === 'shown' && (
            <div className="vb-ans">
              <b>{tt('정답은')} <span lang={langTag(code)}>{ans}</span></b>
              <small>{w[1]}{ans !== w[0] ? ` · ${tt('기본형')} ${w[0]}` : ''}</small>
            </div>
          )}

          <div className="vb-audio">
            <button className="play" aria-label={tt('예문 듣기')} onClick={() => speak(w[2], code)}><Icon name="speak" /></button>
            <span>{tt('예문 듣기')}</span>
            <div className="spd" role="radiogroup" aria-label={tt('듣기 속도')}>
              {SPEEDS.map((v) => (
                <button key={v} role="radio" aria-checked={state.speed === v} className={state.speed === v ? 'on' : ''}
                  onClick={() => { set({ speed: v }); speak(w[2], code, { speed: v }); }}>{v}×</button>
              ))}
            </div>
          </div>

          {!result && (hint
            ? <button className="vb-act vb-ans-btn" onClick={() => end('shown')}><Icon name="eye" />{tt('정답 보기')}</button>
            : <button className="vb-act vb-hint-btn" onClick={() => setHint(true)}><Icon name="bulb" />{tt('힌트 보기')}</button>)}
        </div>

        <div className="vb-foot">
          {result
            ? <Button kind="dark" style={big} onClick={go}>{tt('다음')}</Button>
            : <>
                <Button kind="dark" style={big} disabled={!text.trim()} onClick={check}>{tt('확인')}</Button>
                <div className="vb-links">
                  <Button kind="link" auto onClick={() => end('skip')}>{tt('건너뛰기')}</Button>
                  <i aria-hidden>·</i>
                  <Button kind="link" auto onClick={() => end('known')}>{tt('이미 알아요')}</Button>
                </div>
              </>}
        </div>
      </div>
    </div>
  );
}
