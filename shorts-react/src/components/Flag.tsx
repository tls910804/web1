// 언어마다 대표 국기 하나 (영어=미국, 스페인어=스페인, 포르투갈어=포르투갈). 국기 이모지는 윈도우에서 글자로 보여서 직접 그린다.
// shortcut: 태극기 괘·성조기 별은 단순화, 실제 국기 그림이 필요하면 svg 파일로 바꾼다.
const star = (cx: number, cy: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.4 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }).join(' ');

const FLAGS: Record<string, string> = {
  ko: '<rect width="36" height="36" fill="#fff"/><path d="M9.7 18a8.3 8.3 0 0 1 16.6 0z" fill="#cd2e3a"/><path d="M9.7 18a8.3 8.3 0 0 0 16.6 0z" fill="#0047a0"/><g fill="#000"><rect x="4" y="7.5" width="6" height="2.6" transform="rotate(-35 7 8.8)"/><rect x="26" y="7.5" width="6" height="2.6" transform="rotate(35 29 8.8)"/><rect x="4" y="26" width="6" height="2.6" transform="rotate(35 7 27.3)"/><rect x="26" y="26" width="6" height="2.6" transform="rotate(-35 29 27.3)"/></g>',
  en: '<rect width="36" height="36" fill="#fff"/>' + [0, 2, 4, 6].map((i) => `<rect y="${(i * 36) / 7}" width="36" height="${36 / 7 + 0.2}" fill="#b22234"/>`).join('') + '<rect width="18" height="20.6" fill="#3c3b6e"/><g fill="#fff"><circle cx="5" cy="5" r="1.2"/><circle cx="11.5" cy="5" r="1.2"/><circle cx="8.2" cy="10.3" r="1.2"/><circle cx="5" cy="15.6" r="1.2"/><circle cx="11.5" cy="15.6" r="1.2"/></g>',
  ja: '<rect width="36" height="36" fill="#fff"/><circle cx="18" cy="18" r="7.6" fill="#bc002d"/>',
  zh: `<rect width="36" height="36" fill="#de2910"/><g fill="#ffde00"><polygon points="${star(11.5, 12, 5.4)}"/><polygon points="${star(20, 5.8, 1.8)}"/><polygon points="${star(23.8, 10.4, 1.8)}"/><polygon points="${star(23.8, 16.5, 1.8)}"/><polygon points="${star(20, 21.2, 1.8)}"/></g>`,
  es: '<rect width="36" height="36" fill="#aa151b"/><rect y="9.7" width="36" height="16.6" fill="#f1bf00"/>',
  id: '<rect width="36" height="36" fill="#fff"/><rect width="36" height="18" fill="#ce1126"/>',
  vi: `<rect width="36" height="36" fill="#da251d"/><polygon points="${star(18, 18.6, 9)}" fill="#ffcd00"/>`,
  fr: '<rect width="36" height="36" fill="#fff"/><rect width="12" height="36" fill="#0055a4"/><rect x="24" width="12" height="36" fill="#ef4135"/>',
  de: '<rect width="36" height="36" fill="#ffce00"/><rect width="36" height="12" fill="#000"/><rect y="12" width="36" height="12" fill="#dd0000"/>',
  pt: '<rect width="36" height="36" fill="#da291c"/><rect width="15" height="36" fill="#046a38"/><circle cx="15" cy="18" r="5.8" fill="#ffe900"/><circle cx="15" cy="18" r="3.2" fill="#da291c"/>',
  ru: '<rect width="36" height="36" fill="#d52b1e"/><rect width="36" height="12" fill="#fff"/><rect y="12" width="36" height="12" fill="#0039a6"/>',
};

// 흰 국기(일본·인도네시아)가 흰 카드에 묻히지 않게 얇은 테두리
const RING = '<circle cx="18" cy="18" r="17.5" fill="none" stroke="#000" stroke-opacity=".12"/>';

/** 언어 목록 보여 줄 순서 (온보딩 · 언어 설정 같이 씀) */
export const LANG_ORDER = ['ko', 'en', 'ja', 'zh', 'es', 'id', 'vi', 'fr', 'de', 'pt', 'ru'];
export const byOrder = (a: { code: string }, b: { code: string }) => LANG_ORDER.indexOf(a.code) - LANG_ORDER.indexOf(b.code);

export function Flag({ code, size = 34 }: { code: string; size?: number }) {
  // FLAGS는 코드 안의 고정 svg라 그대로 넣어도 안전하다.
  return <svg className="flag" width={size} height={size} viewBox="0 0 36 36" aria-hidden dangerouslySetInnerHTML={{ __html: (FLAGS[code] || '<rect width="36" height="36" fill="#ccc"/>') + RING }} />;
}
