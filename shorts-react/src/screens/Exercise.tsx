import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { FaceButton } from '../components/FaceButton';
import { Icon } from '../components/Icon';
import { NO_SPACE } from '../constants';
import { CARDS } from '../data';
import { daysLabel, rateResult } from '../lib/srs';
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

type Miss = { w: string; mean: string };

export function Exercise({ kind, item, onDone, onSkip }: { kind: ExKind; item: SavedItem; onDone: (ok: boolean) => void; onSkip: () => void }) {
  const { state } = useStore();
  const { speak } = useUi();
  const c = item.card;
  const idx = blankOf(item);
  const answer = clean(join(c, idx.map((i) => c.words[i])));
  const ansMean = item.kind === 'w' ? wordInfo(c, item.wi, state.native).mean : trOf(c.mean, state.native);
  const [text, setText] = useState('');
  const [hint, setHint] = useState(false);
  const [phase, setPhase] = useState<'ask' | 'ok' | 'reveal'>('ask');
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
    else setPhase('reveal');
  };

  if (kind === 'dictation') {
    return (
      <>
        <div className="rv-body ex-body">
          <div className="rcard ex ex-dict">
            <span className="rc-chip">듣고 받아쓰기 · {lang(c.lang).name}</span>
            <button className="ex-play" aria-label="발음 듣기" onClick={() => speak(sentence(c), c.lang)}><Icon name="speak" /></button>
            <button className="ex-slow" onClick={() => speak(sentence(c), c.lang, { rate: 0.7 })}>느리게 듣기</button>
          </div>
          <p className="ex-cap">들은 문장을 그대로 써 보세요</p>
          <textarea className="ex-input" value={text} disabled={res !== null} lang={langTag(c.lang)} rows={3}
            autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(e) => setText(e.target.value)} />
          {res === null && <button className="lnk ex-hint" onClick={() => setHint(true)}>{hint ? `첫 단어: ${clean(c.words[0])}` : '첫 단어 힌트 보기'}</button>}
        </div>
        <div className="foot">
          {res !== null ? (
            <div className={`ex-fb ${res ? 'ok' : 'no'}`}>
              <b>{res ? '정답이에요!' : '아쉬워요'}</b>
              <small lang={langTag(c.lang)}>{sentence(c)}</small>
              <Button kind="dark" style={{ minHeight: 49, padding: '14px 16px' }} onClick={() => onDone(res)}>다음</Button>
            </div>
          ) : (
            <>
              <Button kind="dark" style={{ minHeight: 49, padding: '14px 16px' }} disabled={!text.trim()} onClick={() => setRes(norm(text, c.lang) === norm(sentence(c), c.lang))}>확인</Button>
              <Button kind="link" style={{ marginTop: -6 }} onClick={onSkip}>건너뛰기</Button>
            </>
          )}
        </div>
      </>
    );
  }

  // 정답 확인: 뜻과 헷갈린 표현을 보고 스스로 평가한다
  if (phase === 'reveal') {
    return (
      <>
        <div className="rv-body">
          <div className="rcard back">
            <span className="rc-chip">{c.cat} · {lang(c.lang).name}</span>
            <div className="rc-main">
              <p className="rc-s" lang={langTag(c.lang)}>{sentence(c)}</p>
              <div className="rc-line" />
              <p className="rc-tr">{tr}</p>
              <div className="rc-expr"><b lang={langTag(c.lang)}>{answer}</b><span>{ansMean}</span></div>
              {lastMiss && (
                <div className="ex-conf">
                  <small>이 표현과 헷갈리기 쉬워요</small>
                  <b lang={langTag(c.lang)}>{lastMiss.w} = {lastMiss.mean}</b>
                  <span>‘{lastMiss.mean}’라는 뜻이라 이 문장과는 맞지 않아요.</span>
                </div>
              )}
            </div>
            <div className="rc-rail">
              <button aria-label="발음 듣기" onClick={() => speak(sentence(c), c.lang)}><Icon name="speak" /></button>
              <button aria-label="느리게 듣기" onClick={() => speak(sentence(c), c.lang, { rate: 0.7 })}><Icon name="clock" /></button>
            </div>
          </div>
        </div>
        <div className="foot back">
          <div className="rates">
            <FaceButton kind="again" label="다시 볼래요" sub="5분 뒤" onClick={() => onDone(false)} />
            <FaceButton kind="good" label="기억나요" sub={daysLabel(rateResult(state.mode, item, 'good').days)} onClick={() => onDone(true)} />
          </div>
        </div>
      </>
    );
  }

  const ok = phase === 'ok';
  const first = idx[0], last = idx[idx.length - 1];
  const tail = c.words[last].match(/[.,!?。、！？]+$/)?.[0] ?? '';
  const parts: React.ReactNode[] = [];
  c.words.forEach((w, i) => {
    if (i === first) {
      parts.push(
        <span key={i} className={`ex-blank${ok ? ' ok' : wrong ? ' no' : ''}`}>
          {ok ? answer : (
            <input ref={input} value={text} lang={langTag(c.lang)} aria-label="빈칸 입력" enterKeyHint="done"
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
          <span className="rc-chip">빈칸 채우기 · {lang(c.lang).name}</span>
          <p className="rc-s" lang={langTag(c.lang)}>{parts}</p>
          <p className="rc-tr">{tr}</p>
          {miss && (
            <div className="ex-why">
              <b lang={langTag(c.lang)}>{miss.w} = {miss.mean}</b>
              <span>뜻이 달라서 맞지 않아요. 이 자리는 ‘{ansMean}’라는 뜻이에요.</span>
            </div>
          )}
          {!ok && (
            <div className="ex-acts">
              {hint
                ? <button className="ex-pill" onClick={() => setPhase('reveal')}>정답 보기</button>
                : <button className="ex-pill" onClick={() => { setHint(true); if (!norm(answer, c.lang).startsWith(norm(text, c.lang)) || text.length < nHint) setText(answer.slice(0, nHint)); input.current?.focus(); }}>힌트 보기</button>}
              {!hint && !miss && <span className="ex-meta">{NO_SPACE[c.lang] ? '' : `${words}단어 · `}{answer.replace(/\s/g, '').length}글자</span>}
              <button className="lnk ex-skip" onClick={onSkip}>건너뛰기</button>
            </div>
          )}
        </div>
        {!ok && <p className="ex-cap">{hint ? `앞 ${nHint === 2 ? '두' : '한'} 글자를 보여 드렸어요` : '빈칸에 알맞은 표현을 직접 써 보세요'}</p>}
      </div>
      {ok && (
        <div className="foot">
          <div className="ex-fb ok">
            <b>정답이에요!</b>
            <small lang={langTag(c.lang)}>{answer} = {ansMean}</small>
            <Button kind="dark" style={{ minHeight: 49, padding: '14px 16px' }} onClick={() => onDone(true)}>다음</Button>
          </div>
        </div>
      )}
    </>
  );
}
