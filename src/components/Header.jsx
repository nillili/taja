import { TABS } from "../data/tabs.js";

// 나가기(로그아웃) 아이콘 — 문 밖으로 나가는 화살표
function ExitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
      <path d="M17 8l4 4-4 4" />
      <path d="M21 12H10" />
    </svg>
  );
}

// 상단 헤더: 〈타자연습〉 로고(메인으로) + 사용자 칩(이름·학교·나가기) + 연습 탭 4개
export default function Header({ screen, goHome, goTab, user = null, onLogout }) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-left">
          <button className="logo" onClick={goHome} title="메인으로">
            <span className="logo-mark">타</span>
            <span className="logo-title">타자연습</span>
            <span className="logo-sub">han·gul</span>
          </button>

          {user && (
            <div className="user-chip">
              <span className="user-chip-name" title={user.name}>{user.name}</span>
              <span className="user-chip-school" title={user.school}>{user.school}</span>
              <button
                className="user-chip-out"
                onClick={onLogout}
                title="나가기 (다음 사람이 새로 이름을 적어요)"
                aria-label="나가기"
              >
                <ExitIcon />
              </button>
            </div>
          )}
        </div>

        <nav className="tabs" aria-label="연습 메뉴">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={"tab" + (screen === t.id ? " is-active" : "")}
              onClick={() => goTab(t.id)}
            >
              <span className="tab-num">{t.num}</span>
              {t.ko}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
