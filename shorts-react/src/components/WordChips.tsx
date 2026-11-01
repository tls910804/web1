import type { Card } from '../types';

interface Props {
  card: Card;
  highlight?: number[];
  selected?: number[];
  onWord?: (wi: number) => void;
}

export function WordChips({ card, highlight, selected, onWord }: Props) {
  const hl = highlight ?? card.key;
  return (
    <div className="words">
      {card.words.map((w, j) => (
        <button
          key={j}
          className={`w${hl.includes(j) ? ' key' : ''}${selected?.includes(j) ? ' sel' : ''}`}
          onClick={onWord ? () => onWord(j) : undefined}
        >{w}</button>
      ))}
    </div>
  );
}
