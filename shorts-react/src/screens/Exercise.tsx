import { useEffect, useRef, useState } from 'react';
import { tt } from '../i18n';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { NO_SPACE } from '../constants';
import { CARDS } from '../data';
import { rateResult } from '../lib/srs';
import { clean, lang, langTag, sentence, trOf, wordInfo } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';
import type { Card, SavedItem } from '../types';

export type ExKind = 'type' | 'dictation';

export const join = (c: Card, ws: string[]) => ws.join(NO_SPACE[c.lang] ? '' : ' ');
/** 빈칸으로 비울 단어 조각: 단어 저장은 그 단어, 문장·표현 저장은 핵심 표현 */
export const blankOf = (item: SavedItem) => (item.kind === 'w' && item.wi >= 0 ? [item.wi] : item.card.key);

/** 오래 기억한 문장(4단계~)은 받아쓰기, 나머지는 빈칸 직접 쓰기. 빈칸을 정할 수 없으면 기존 카드 */
export function exKind(item: SavedItem): ExKind | null {
  if (item.kind === 's' && item.step >= 4) return 'dictation';
  return blankOf(item).length ? 'type' : null;
}

/** 빈칸 너비용 글자 수: 한글·한자·가나는 영문보다 두 배쯤 넓어요 */
export const visLen = (s: string) => [...s].reduce((n, c) => n + (/[\u1100-\u11ff\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(c) ? 2.2 : 1), 0);

export const norm = (s: string, code: string) => {
  const t = s.toLowerCase().replace(/[¡¿.,!?。、！？'"’“”]/g, '');
  return NO_SPACE[code] ? t.replace(/\s+/g, '') : t.replace(/\s+/g, ' ').trim();
};

// 같은 언어 카드의 표현·단어 뜻 사전 (잘못 쓴 단어 설명용)
const dicts: Record<string, Map<string, string>> = {};
function dict(code: string, native: string) {
  const k = code + native;
  if (dicts[k]) return dicts[k];
  const m = new Map<string, string>();
  CARDS.filter((c) => c.lang === code).forEach((c) => {
    c.words.forEach((w, i) => {
      if (c.key.includes(i)) return;
      const t = norm(clean(w), code), mean = wordInfo(c, i, native).mean;
      if (t && mean && !m.has(t)) m.set(t, mean);
    });
    const e = norm(clean(join(c, c.key.map((i) => c.words[i]))), code);
    if (e) m.set(e, trOf(c.mean, native));
  });
  return (dicts[k] = m);
}

/** 쓰고 있는 글자 중 뜻을 아는 틀린 단어를 찾는다 */
export function findMiss(text: string, answer: string, code: string, native: string) {
  const t = norm(text, code), a = norm(answer, code);
  if (!t || a.startsWith(t)) return null;
  const d = dict(code, native);
  if (d.has(t)) return { w: text.trim(), mean: d.get(t)! };
  if (NO_SPACE[code]) return null;
  const tw = t.split(' '), aw = a.split(' ');
  for (let i = 0; i < tw.length; i++) {
    if (aw[i]?.startsWith(tw[i])) continue;
    const mean = d.get(tw[i]);
    return mean ? { w: tw[i], mean } : null;
  }
  return null;
}

const when = (days: number) => (days === 1 ? tt('내일') : tt('{n}일 뒤에', { n: days }));
type Miss = { w: string; mean: string };

/** 정답 효과음: 파일 없이 짧은 '띵' */
export function ding() {
  try {
    const A = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new A(), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.36);
    o.onended = () => ctx.close();
  } catch { /* 소리를 못 내도 공부는 계속 */ }
}
/** 편집 거리로 몇 글자 다른지, 그리고 내가 쓴 글자 중 틀린 자리 */
export function diff(typed: string, ans: string) {
  const m = typed.length, n = ans.length;
  const d = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i ? (j ? 0 : i) : j)));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (typed[i - 1] === ans[j - 1] ? 0 : 1));
  const bad = new Set<number>();
  for (let i = m, j = n; i > 0 || j > 0;) {
    if (i && j && d[i][j] === d[i - 1][j - 1] + (typed[i - 1] === ans[j - 1] ? 0 : 1)) { if (typed[i - 1] !== ans[j - 1]) bad.add(i - 1); i--; j--; }
    else if (i && d[i][j] === d[i - 1][j] + 1) { bad.add(i - 1); i--; }
    else { if (i) bad.add(i - 1); else bad.add(0); j--; } // 빠진 글자는 그 앞 글자에 표시
  }
  return { n: d[m][n], bad };
}

/** 뜻 문장에서 빈칸에 해당하는 부분을 색으로 */
export function KoLine({ card, native }: { card: Card; native: string }) {
  const tr = trOf(card.tr, native), k = card.trKey?.[native];
  const at = k ? tr.indexOf(k) : -1;
  if (at < 0) return <>{tr}</>;
  return <>{tr.slice(0, at)}<em>{k}</em>{tr.slice(at + k!.length)}</>;
}


/** 빈칸에 쓴 답이 왜 틀렸는지: 정답 보기 뒤 안내 · 뜻이 다른 단어 · 철자 차이 · 다른 말 (자동 공부와 복습이 같이 쓴다) */
export function BlankNote({ code, text, answer, mean, shown, tried, miss }: { code: string; text: string; answer: string; mean: string; shown: boolean; tried: boolean; miss: Miss | null }) {
  const a = norm(answer, code), t = norm(text, code);
  // 다른 글자 자리 표시
  // 뜻을 모르는 단어: 철자만 조금 다르면 글자 차이, 아예 다른 말이면 맞은 단어와 이 자리에 필요한 뜻
  const df = tried && !miss ? diff(t, a) : null;
  const sp0 = NO_SPACE[code] ? '' : ' ';
  const near = (x: string, y: string) => diff(x, y).n <= Math.max(1, Math.floor(y.length / 3));
  // 단어마다 비교해 철자 실수인지 다른 말인지 가른다 (띄어 쓰지 않는 언어는 문장 전체로)
  const typo = !!df && (sp0 ? t.split(' ').length === a.split(' ').length && t.split(' ').every((w, k) => w === a.split(' ')[k] || near(w, a.split(' ')[k])) : near(t, a));
  const marked = typo ? [...t].map((ch, k) => <span key={k} className={df!.bad.has(k) ? 'bad' : ''}>{ch}</span>) : null;
  const sp = NO_SPACE[code] ? '' : ' ';
  const tw = t.split(sp || /(?:)/), aw = a.split(sp || /(?:)/);
  let same = 0;
  while (sp && same < tw.length && tw[same] === aw[same]) same++;
  const other = df && !typo ? { good: tw.slice(0, same).join(sp), bad: tw.slice(same).join(sp) || t } : null;

  return (
    <>
      {shown && <div className="st-note info">{tt('정답을 확인하고, 다시 입력해 보세요')}</div>}
      {!shown && miss && <div className="st-note warn"><b lang={langTag(code)}>{miss.w} = {miss.mean}</b>{tt('뜻이 달라서 맞지 않아요. 이 자리는 ‘{m}’라는 뜻이에요.', { m: mean })}</div>}
      {!shown && !miss && marked && <div className="st-note warn"><span lang={langTag(code)}>{marked}</span>{tt(' — 철자가 {n}글자 달라요', { n: df!.n })}</div>}
      {!shown && other && (
        <div className="st-note warn">
          <b lang={langTag(code)}>{tt('‘{w}’는 이 자리에 맞지 않아요', { w: other.bad })}</b>
          {other.good && <>{tt('‘{w}’까지는 맞았어요. ', { w: other.good })}</>}
          {tt('이 자리에는 ‘{m}’라는 뜻의 표현이 들어가요.', { m: mean })}
        </div>
      )}
    </>
  );
}


/** practice: 온보딩 체험용. 모르면 평가 대신 정답과 '5분 뒤' 안내를 바로 보여준다 */
export function Exercise({ kind, item, onDone, onSkip, practice }: { kind: ExKind; item: SavedItem; onDone: (ok: boolean, hinted?: boolean) => void; onSkip: () => void; practice?: boolean }) {
  const { state } = useStore();
  const { speak } = useUi();
  const c = item.card;
  const idx = blankOf(item);
  const answer = clean(join(c, idx.map((i) => c.words[i])));
  const ansMean = item.kind === 'w' ? wordInfo(c, item.wi, state.native).mean : trOf(c.mean, state.native);
  const [text, setText] = useState('');
  const [hint, setHint] = useState(false);
  const [phase, setPhase0] = useState<'ask' | 'ok' | 'no'>('ask');
  const setPhase = (p: 'ok' | 'no') => { navigator.vibrate?.(p === 'ok' ? 12 : [20, 40, 20]); setPhase0(p); };
  const [res, setRes] = useState<boolean | null>(null);
  const [shown, setShown] = useState(false); // 정답 보기: 흐리게 깔아 두고 다시 써 보게 한다
  const [sent, setSent] = useState(false); // 엔터로 냈으면 짧게 써도 틀린 이유를 보여준다
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);

  const tr = trOf(c.tr, state.native);
  const miss = phase === 'ask' && !shown && text ? findMiss(text, answer, c.lang, state.native) : null;
  const a = norm(answer, c.lang), t = norm(text, c.lang);
  const tried = phase === 'ask' && !shown && !!t && t !== a && (t.length >= a.length || sent);
  // 빈칸이 핵심 표현이면 뜻 문장에서 그 부분을 색으로 (단어 저장은 해당 없음)
  const keyBlank = idx.join() === c.key.join();
  const wrong = phase === 'ask' && !!norm(text, c.lang) && !norm(answer, c.lang).startsWith(norm(text, c.lang));
  const nHint = answer.length > 3 ? 2 : 1;

  const onType = (v: string) => {
    setText(v); setSent(false);
    if (norm(v, c.lang) !== a) return;
    if (shown) setPhase('no'); // 정답을 보고 쓴 건 '다시'로
    else { ding(); setPhase('ok'); }
  };
  const submit = () => { if (text.trim()) setSent(true); };
  const giveUp = () => (practice ? setPhase('no') : onSkip());
  // 복습 정책: 틀리면 5분 뒤 다시, 맞히면 간격을 늘리되 힌트를 봤으면 한 단계 덜 늘린다
  const days = rateResult(state.mode, item, hint ? 'hard' : 'good').days;

  if (kind === 'dictation') {
    return (
      <>
        <div className="rv-body ex-body">
          <div className="rcard ex ex-dict">
            <span className="rc-chip">{tt('듣고 받아쓰기')} · {lang(c.lang).name}</span>
            <button className="ex-play" aria-label={tt('발음 듣기')} onClick={() => speak(sentence(c), c.lang)}><Icon name="speak" /></button>
            <button className="ex-slow" onClick={() => speak(sentence(c), c.lang, { rate: 0.7 })}>{tt('느리게 듣기')}</button>
          </div>
          <p className="ex-cap">{tt('들은 문장을 그대로 써 보세요')}</p>
          <textarea className="ex-input" value={text} disabled={res !== null} lang={langTag(c.lang)} rows={3}
            autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(e) => setText(e.target.value)} />
          {res === null && <button className="lnk ex-hint" onClick={() => setHint(true)}>{hint ? tt('첫 단어: {w}', { w: clean(c.words[0]) }) : tt('첫 단어 힌트 보기')}</button>}
        </div>
        <div className="foot">
          {res !== null ? (
            <div className={`ex-fb ${res ? 'ok' : 'no'}`}>
              <div className="ex-note">
<b>{res ? tt('정답이에요! {when} 다시 보여 드려요', { when: when(rateResult(state.mode, item, 'good').days) }) : tt('괜찮아요! 5분 뒤에 다시 보여 드려요')}</b>
              <small lang={langTag(c.lang)}>{sentence(c)}</small>
</div>
              <Button kind="dark" style={{ minHeight: 49, padding: '14px 16px' }} onClick={() => onDone(res)}>{tt('다음')}</Button>
            </div>
          ) : (
            <>
              <Button kind="dark" style={{ minHeight: 49, padding: '14px 16px' }} disabled={!text.trim()} onClick={() => setRes(norm(text, c.lang) === norm(sentence(c), c.lang))}>{tt('확인')}</Button>
              <Button kind="link" style={{ marginTop: -6 }} onClick={onSkip}>{tt('건너뛰기')}</Button>
            </>
          )}
        </div>
      </>
    );
  }

  const ok = phase === 'ok', no = phase === 'no', end = ok || no;
  const first = idx[0], last = idx[idx.length - 1];
  const tail = c.words[last].match(/[.,!?。、！？]+$/)?.[0] ?? '';
  const parts: React.ReactNode[] = [];
  c.words.forEach((w, i) => {
    if (i === first) {
      parts.push(
        <span key={i} className={`ex-blank${ok ? ' ok' : (wrong && !shown) || no ? ' no' : ''}`}>
          {shown && !end && <span className="ghost" aria-hidden>{answer}</span>}
          {end ? answer : (
            <input ref={input} value={text} lang={langTag(c.lang)} aria-label={tt('빈칸 입력')} enterKeyHint="done"
              autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
              style={{ width: `${(Math.max(visLen(answer), visLen(text)) + 1) * 0.8}ch` }}
              onChange={(e) => onType(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          )}
        </span>, tail, ' ',
      );
    } else if (!idx.includes(i)) parts.push(w, ' ');
  });
  const words = NO_SPACE[c.lang] ? 1 : answer.split(/\s+/).length;

  return (
    <>
      <div className="rv-body ex-body">
        <div className="rcard ex">
          <span className="rc-chip">{tt('빈칸 채우기')} · {lang(c.lang).name}</span>
          <p className="rc-s" lang={langTag(c.lang)}>{parts}</p>
          <p className="rc-tr">{keyBlank ? <KoLine card={c} native={state.native} /> : tr}</p>
          <BlankNote code={c.lang} text={text} answer={answer} mean={ansMean} shown={shown && !end} tried={tried} miss={miss} />
          {!end && (
            <div className="ex-acts">
              {hint
                ? <button className="ex-pill" disabled={shown} onClick={() => { setShown(true); setText(''); input.current?.focus(); }}>{tt('정답 보기')}</button>
                : <button className="ex-pill" onClick={() => { setHint(true); if (!norm(answer, c.lang).startsWith(norm(text, c.lang)) || text.length < nHint) setText(answer.slice(0, nHint)); input.current?.focus(); }}>{tt('힌트 보기')}</button>}
              <button className="ex-pill" aria-label={tt('발음 듣기')} onClick={() => { speak(sentence(c), c.lang); input.current?.focus(); }}><Icon name="speak" />{tt('듣기')}</button>
              {!hint && !miss && !tried && <span className="ex-meta">{NO_SPACE[c.lang] ? '' : `${tt('{n}단어', { n: words })} · `}{tt('{n}글자', { n: answer.replace(/\s/g, '').length })}</span>}
              <button className="lnk ex-skip" onClick={giveUp}>{tt('건너뛰기')}</button>
            </div>
          )}
        </div>
        {!end && <p className="ex-cap">{shown ? tt('정답을 보고 그대로 따라 써 보세요') : hint ? tt(nHint === 2 ? '앞 두 글자를 보여 드렸어요' : '앞 한 글자를 보여 드렸어요') : practice ? tt('방금 저장한 표현이에요. 빈칸에 직접 써 보세요') : (keyBlank && c.trKey?.[state.native] ? tt('색이 다른 부분에 맞는 표현을 빈칸에 써 보세요') : tt('빈칸에 알맞은 표현을 직접 써 보세요'))}</p>}
      </div>
      {end && (
        <div className="foot">
          <div className={`ex-fb ${ok ? 'ok' : 'no'}`}>
            <div className="ex-note">
<b>{ok ? tt('정답이에요! {when} 다시 보여 드려요', { when: practice ? tt('3일 뒤에') : when(days) }) : tt('괜찮아요! 5분 뒤에 다시 보여 드려요')}</b>
            <small lang={langTag(c.lang)}>{practice ? (ok ? tt('잘 기억할수록 다시 나오는 간격이 길어져요') : tt('헷갈린 문장은 금방 다시 나와서 바로 복습할 수 있어요')) : `${answer} = ${ansMean}`}</small>
</div>
            <Button kind="dark" style={{ minHeight: 49, padding: '14px 16px' }} onClick={() => onDone(ok || !!practice, hint)}>{tt('다음')}</Button>
          </div>
        </div>
      )}
    </>
  );
}
