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

const join = (c: Card, ws: string[]) => ws.join(NO_SPACE[c.lang] ? '' : ' ');
/** 빈칸으로 비울 단어 조각: 단어 저장은 그 단어, 문장·표현 저장은 핵심 표현 */
const blankOf = (item: SavedItem) => (item.kind === 'w' && item.wi >= 0 ? [item.wi] : item.card.key);

/** 오래 기억한 문장(4단계~)은 받아쓰기, 나머지는 빈칸 직접 쓰기. 빈칸을 정할 수 없으면 기존 카드 */
export function exKind(item: SavedItem): ExKind | null {
  if (item.kind === 's' && item.step >= 4) return 'dictation';
  return blankOf(item).length ? 'type' : null;
}

const norm = (s: string, code: string) => {
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
function findMiss(text: string, answer: string, code: string, native: string) {
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

/** practice: 온보딩 체험용. 모르면 평가 대신 정답과 '5분 뒤' 안내를 바로 보여준다
 *  auto: 자동 공부용. 뜻은 숨기고, 다시 듣기를 보여주고, 끝나면 아래 안내 없이 바로 onDone */
export function Exercise({ kind, item, onDone, onSkip, practice, auto }: { kind: ExKind; item: SavedItem; onDone: (ok: boolean, hinted?: boolean) => void; onSkip: () => void; practice?: boolean; auto?: boolean }) {
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
  const [lastMiss, setLastMiss] = useState<Miss | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);

  const tr = trOf(c.tr, state.native);
  const miss = phase === 'ask' ? findMiss(text, answer, c.lang, state.native) : null;
  useEffect(() => { if (miss) setLastMiss(miss); }, [miss?.w]); // eslint-disable-line react-hooks/exhaustive-deps
  const wrong = phase === 'ask' && !!norm(text, c.lang) && !norm(answer, c.lang).startsWith(norm(text, c.lang));
  const nHint = answer.length > 3 ? 2 : 1;

  const onType = (v: string) => {
    setText(v);
    if (norm(v, c.lang) === norm(answer, c.lang)) setPhase('ok');
  };
  const submit = () => {
    if (!text.trim()) return;
    if (norm(text, c.lang) === norm(answer, c.lang)) setPhase('ok');
    else setPhase('no');
  };
  const giveUp = () => (practice || auto ? setPhase('no') : onSkip());
  useEffect(() => { if (auto && phase !== 'ask') onDone(phase === 'ok', hint); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
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
        <span key={i} className={`ex-blank${ok ? ' ok' : wrong || no ? ' no' : ''}`}>
          {end ? answer : (
            <input ref={input} value={text} lang={langTag(c.lang)} aria-label={tt('빈칸 입력')} enterKeyHint="done"
              autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
              style={{ width: `${Math.max(answer.length, text.length) + 1}ch` }}
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
          {!auto && <p className="rc-tr">{tr}</p>}
          {(miss || (no && lastMiss)) && (
            <div className="ex-why">
              <b lang={langTag(c.lang)}>{(miss || lastMiss)!.w} = {(miss || lastMiss)!.mean}</b>
              <span>{tt('뜻이 달라서 맞지 않아요. 이 자리는 ‘{m}’라는 뜻이에요.', { m: ansMean })}</span>
            </div>
          )}
          {!end && (
            <div className="ex-acts">
              {hint
                ? <button className="ex-pill" onClick={() => setPhase('no')}>{tt('정답 보기')}</button>
                : <button className="ex-pill" onClick={() => { setHint(true); if (!norm(answer, c.lang).startsWith(norm(text, c.lang)) || text.length < nHint) setText(answer.slice(0, nHint)); input.current?.focus(); }}>{tt('힌트 보기')}</button>}
              {auto && <button className="ex-pill ex-again" onClick={() => { speak(sentence(c), c.lang); input.current?.focus(); }}><Icon name="speak" />{tt('다시 듣기')}</button>}
              {!hint && !miss && !auto && <span className="ex-meta">{NO_SPACE[c.lang] ? '' : `${tt('{n}단어', { n: words })} · `}{tt('{n}글자', { n: answer.replace(/\s/g, '').length })}</span>}
              <button className="lnk ex-skip" onClick={giveUp}>{auto ? tt('넘어가기') : tt('건너뛰기')}</button>
            </div>
          )}
        </div>
        {!end && <p className="ex-cap">{hint ? tt(nHint === 2 ? '앞 두 글자를 보여 드렸어요' : '앞 한 글자를 보여 드렸어요') : auto ? tt('방금 들은 표현을 빈칸에 써 보세요') : practice ? tt('방금 저장한 표현이에요. 빈칸에 직접 써 보세요') : tt('빈칸에 알맞은 표현을 직접 써 보세요')}</p>}
      </div>
      {end && !auto && (
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
