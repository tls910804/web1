import { useEffect, useRef } from 'react';
import { NO_SPACE } from '../constants';
import { langTag } from '../lib/text';
import type { Card } from '../types';

interface Props {
  card: Card;
  highlight?: number[];
  selected?: number[];
  onWord?: (wi: number) => void;
  small?: boolean;
  /** 영상 재생 중 지금 말하는 단어 (-1: 아직 시작 전) */
  spoken?: number;
  /** 줄이 넘치면 쪽으로 나눠 좌우로 넘긴다 (마우스로 끌어도 넘어간다) */
  paged?: boolean;
}

export function WordChips({ card, highlight, selected, onWord, small, spoken, paged }: Props) {
  const hl = highlight ?? card.key;
  const box = useRef<HTMLDivElement>(null);
  // 영상 재생 중 지금 말하는 단어가 다음 쪽(가로로 넘치는 칸)에 있으면 그 쪽으로 넘긴다
  useEffect(() => {
    const el = box.current, now = el?.querySelector<HTMLElement>('.now');
    if (el && now) { const page = el.clientWidth + (parseFloat(getComputedStyle(el).columnGap) || 0); el.scrollTo({ left: Math.floor(now.offsetLeft / page) * page, behavior: 'smooth' }); }
    else if (el && (spoken ?? -1) < 0) el.scrollTo({ left: 0, behavior: 'smooth' });
  }, [spoken]);

  // 마우스로 끌면 넘기고, 놓으면 가까운 쪽에 맞춘다. 끌었으면 단어 클릭은 무시한다
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const pageOf = (el: HTMLElement) => el.clientWidth + (parseFloat(getComputedStyle(el).columnGap) || 0);
  const dragProps = paged ? {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => { if (e.pointerType === 'mouse') drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, moved: false }; },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => { const d = drag.current; if (!d) return; const dx = e.clientX - d.x; if (Math.abs(dx) > 5) d.moved = true; e.currentTarget.scrollLeft = d.left - dx; },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => { const el = e.currentTarget, d = drag.current; if (!d) return; const p = pageOf(el), dx = e.clientX - d.x; const start = Math.round(d.left / p); el.scrollTo({ left: (Math.abs(dx) > 40 ? start + (dx < 0 ? 1 : -1) : start) * p, behavior: 'smooth' }); setTimeout(() => { drag.current = null; }); },
    onPointerLeave: (e: React.PointerEvent<HTMLDivElement>) => { if (drag.current) { const el = e.currentTarget, p = pageOf(el); el.scrollTo({ left: Math.round(el.scrollLeft / p) * p, behavior: 'smooth' }); drag.current = null; } },
    onClickCapture: (e: React.MouseEvent) => { if (drag.current?.moved) e.stopPropagation(); },
  } : {};
  // 붙어 있는 핵심 표현은 한 덩어리로 합친다 (영상 자막처럼 단어별로 강조할 땐 그대로)
  const groups: number[][] = [];
  card.words.forEach((_, j) => {
    const last = groups[groups.length - 1];
    if (spoken === undefined && last && hl.includes(j) && hl.includes(j - 1)) last.push(j); else groups.push([j]);
  });
  return (
    <div ref={box} {...dragProps} className={`words${small ? ' sm' : ''}${spoken !== undefined ? ' sync' : ''}${paged ? ' paged' : ''}`} lang={langTag(card.lang)}>
      {groups.map((g) => (
        <button
          key={g[0]}
          className={`w${hl.includes(g[0]) ? ' key' : ''}${g.some((j) => selected?.includes(j)) ? ' sel' : ''}${spoken === g[0] ? ' now' : spoken !== undefined && g[0] < spoken ? ' said' : ''}`}
          onClick={onWord ? () => onWord(g[0]) : undefined}
        >{g.map((j) => card.words[j]).join(NO_SPACE[card.lang] ? '' : ' ')}</button>
      ))}
    </div>
  );
}
