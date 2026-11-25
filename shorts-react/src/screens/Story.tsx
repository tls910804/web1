import { useEffect, useRef, useState } from 'react';
import { tt } from '../i18n';
import { Icon } from '../components/Icon';
import { Code } from './Settings';
import { STORIES } from '../data';
import { LEVELS } from '../constants';
import { stopAudio } from '../lib/audio';
import { speechOk } from '../lib/speech';
import { langTag, sentence, trOf } from '../lib/text';
import { useActions } from '../lib/useActions';
import type { Story } from '../lib/story';
import { useStore } from '../store';
import { useUi } from '../ui';

const hush = () => { stopAudio(); if (speechOk()) speechSynthesis.cancel(); };
// shortcut: 끝나는 순간을 모르는 음성(브라우저 음성)도 있어서 글자 수로 길이를 어림한다. 문단 음성 파일이 생기면 onended로 바꾸기
const guessMs = (text: string, slow: boolean) => Math.max(1600, text.length * (slow ? 95 : 72) + 700);

/** 이야기: 짧은 대화를 한 번에 듣고, 문장마다 뜻을 보고 저장한다 */
export function StoryScreen() {
  const { state } = useStore();
  const [lv, setLv] = useState('전체');
  const [open, setOpen] = useState<Story | null>(null);
  const list = STORIES.filter((s) => state.learn.includes(s.lang) && (lv === '전체' || s.level === lv));
  if (open) return <Reader story={open} onBack={() => setOpen(null)} />;
  return (
    <section className="screen"><div className="page">
      <h2 className="title" style={{ margin: '0 0 4px' }}>{tt('이야기')}</h2>
      <p className="desc">{tt('짧은 대화를 통째로 듣고, 문장마다 공부해요.')}</p>
      <div className="sy-lv">{LEVELS.map((l) => <button key={l} className={lv === l ? 'on' : ''} onClick={() => setLv(l)}>{tt(l)}</button>)}</div>
      {list.length ? list.map((s) => (
        <button key={s.id} className="sy-item" onClick={() => setOpen(s)}>
          <span className="top"><Code c={s.lang} /><i className={`lv lv${LEVELS.indexOf(s.level)}`}>{tt(s.level)}</i><small>{tt('{n}문장', { n: s.cards.length })}</small></span>
          <b>{trOf(s.title, state.native)}</b>
          <span className="pv" lang={langTag(s.lang)}>{sentence(s.cards[0])}</span>
        </button>
      )) : (
        <div className="empty-state"><div className="em-ico"><Icon name="book" /></div><b>{tt('이 난이도의 이야기는 아직 없어요')}</b><p>{tt('곧 더 추가할게요. 다른 난이도를 골라 보세요.')}</p></div>
      )}
    </div></section>
  );
}

function Reader({ story, onBack }: { story: Story; onBack: () => void }) {
  const { state } = useStore();
  const { speak, setStudy, go } = useUi();
  const { toggleSave, findSaved } = useActions();
  const [at, setAt] = useState(-1); // 이어 듣기 중인 줄 (-1: 멈춤)
  const [showTr, setShowTr] = useState(!state.hideTr);
  const timer = useRef(0);
  const stop = () => { clearTimeout(timer.current); hush(); setAt(-1); };
  useEffect(() => () => { clearTimeout(timer.current); hush(); }, []);
  const playFrom = (i: number) => {
    clearTimeout(timer.current);
    if (i >= story.cards.length) { setAt(-1); return; }
    const text = sentence(story.cards[i]);
    setAt(i);
    document.querySelectorAll('.sy-line')[i]?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    speak(text, story.lang, { quiet: i > 0 });
    timer.current = window.setTimeout(() => playFrom(i + 1), guessMs(text, state.speed < 1));
  };
  return (
    <section className="screen sy-read"><div className="page">
      <div className="sy-head">
        <button className="x" aria-label={tt('뒤로')} onClick={() => { stop(); onBack(); }}><Icon name="back" /></button>
        <span><Code c={story.lang} /><i className={`lv lv${LEVELS.indexOf(story.level)}`}>{tt(story.level)}</i></span>
        <button className="x" aria-label={showTr ? tt('뜻 가리기') : tt('뜻 보기')} onClick={() => setShowTr(!showTr)}><Icon name={showTr ? 'eye' : 'eyeOff'} /></button>
      </div>
      <h2 className="title">{trOf(story.title, state.native)}</h2>
      <div className="sy-lines">
        {story.cards.map((c, i) => {
          const saved = !!findSaved('s', c);
          return (
            <div key={c.id} className={`sy-line${at === i ? ' now' : ''}`} onClick={() => { stop(); speak(sentence(c), c.lang); }}>
              <p className="s" lang={langTag(c.lang)}>
                {c.words.map((w, k) => <span key={k} className={c.key.includes(k) ? 'k' : ''}>{w}{NO_GAP.has(c.lang) ? '' : ' '}</span>)}
              </p>
              {showTr && <p className="t">{trOf(c.tr, state.native)}</p>}
              {showTr && c.expr && <p className="e"><b lang={langTag(c.lang)}>{c.expr}</b>{trOf(c.mean, state.native)}</p>}
              <button className={`sv${saved ? ' on' : ''}`} aria-label={saved ? tt('저장 취소') : tt('저장')} onClick={(e) => { e.stopPropagation(); toggleSave('s', c); }}><Icon name="mark" /></button>
            </div>
          );
        })}
      </div>
      {/* 다 읽었으면 바로 이 이야기 문장으로 듣기 → 빈칸 연습 (자동 공부 화면 재사용) */}
      <button className="sy-quiz" onClick={() => { stop(); setStudy({ queue: story.cards, feedIds: [], back: 'story' }); go('study'); }}>
        <Icon name="bulb" /><span><b>{tt('이 이야기로 빈칸 연습')}</b><small>{tt('{n}문장 · 듣고 핵심 표현 써 보기', { n: story.cards.length })}</small></span><Icon name="chev" />
      </button>
    </div>
      <div className="bottom sy-bar">
        <button className="sy-play" onClick={() => (at >= 0 ? stop() : playFrom(0))}>
          <Icon name={at >= 0 ? 'pause' : 'play'} />{at >= 0 ? tt('멈추기') : tt('처음부터 이어 듣기')}
        </button>
      </div>
    </section>
  );
}

const NO_GAP = new Set(['ja', 'zh']);
