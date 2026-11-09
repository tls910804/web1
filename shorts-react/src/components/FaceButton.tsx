/** 복습 답 버튼: 원형 얼굴 픽토그램 + 라벨 + 다음 복습까지 기간 */
export function FaceButton({ kind, label, sub, onClick }: { kind: 'again' | 'good'; label: string; sub: string; onClick: () => void }) {
  return (
    <button className={`face-btn ${kind}`} onClick={onClick}>
      <span className="face">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9.6" />
          <path d="M9 10h2M13 10h2" />
          <path d={kind === 'good' ? 'M8.5 14.5q3.5 3 7 0' : 'M9 15h6'} />
        </svg>
      </span>
      <b>{label}</b><small>{sub}</small>
    </button>
  );
}
