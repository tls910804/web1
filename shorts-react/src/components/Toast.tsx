import { useUi } from '../ui';

export function Toast() {
  const { toastNode, dismissToast } = useUi();
  if (!toastNode) return null;
  const { msg, label, fn } = toastNode;
  return (
    <div className="toast">
      <span>{msg}</span>
      {label && <button onClick={(e) => { e.stopPropagation(); dismissToast(); fn?.(); }}>{label}</button>}
    </div>
  );
}
