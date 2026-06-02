// 웃는 연필 마스코트 — 게임 테마 배너에서만 보임. (이모지 대신 기하 SVG)
export default function PencilMascot() {
  return (
    <svg className="mascot" viewBox="0 0 96 96" width="84" height="84" aria-hidden="true">
      <rect x="32" y="6" width="32" height="14" rx="3" fill="#ff8da1" stroke="#1f1d3a" strokeWidth="2.5" />
      <rect x="32" y="14" width="32" height="6" fill="#c4c4c4" stroke="#1f1d3a" strokeWidth="2.5" />
      <rect x="30" y="20" width="36" height="48" fill="#ffc83a" stroke="#1f1d3a" strokeWidth="2.5" />
      <polygon points="30,68 66,68 58,86 48,92 38,86" fill="#f5d29a" stroke="#1f1d3a" strokeWidth="2.5" strokeLinejoin="round" />
      <polygon points="44,82 48,92 52,82" fill="#1f1d3a" />
      <circle cx="42" cy="40" r="3.2" fill="#1f1d3a" />
      <circle cx="54" cy="40" r="3.2" fill="#1f1d3a" />
      <circle cx="43.4" cy="38.8" r="1" fill="#fff" />
      <circle cx="55.4" cy="38.8" r="1" fill="#fff" />
      <path d="M 41 48 Q 48 56 55 48" fill="none" stroke="#1f1d3a" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="36" cy="46" r="2.5" fill="#ff8da1" opacity="0.8" />
      <circle cx="60" cy="46" r="2.5" fill="#ff8da1" opacity="0.8" />
    </svg>
  );
}
