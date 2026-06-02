import { TABS } from "../data/tabs.js";

// 상단 헤더: 〈타자연습〉 로고(메인으로) + 연습 탭 4개
export default function Header({ screen, goHome, goTab }) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <button className="logo" onClick={goHome} title="메인으로">
          <span className="logo-mark">타</span>
          <span className="logo-title">타자연습</span>
          <span className="logo-sub">han·gul</span>
        </button>

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
