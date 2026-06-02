const { useState, useEffect } = React;

/* ------------------------------------------------------------------ */
/*  Tweak defaults                                                     */
/* ------------------------------------------------------------------ */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "themeStyle": "paper",
  "showHands": true
}/*EDITMODE-END*/;

const TABS = [
  { id: "jari",    num: "02", ko: "자리연습",  desc: "기본 자리에 손가락을 올려두고, 한 글자씩." },
  { id: "natmal",  num: "03", ko: "낱말연습",  desc: "짧은 낱말로 손가락 움직임을 익혀요." },
  { id: "danmun",  num: "04", ko: "단문연습",  desc: "한 줄짜리 문장으로 속도를 붙여봐요." },
  { id: "jangmun", num: "05", ko: "장문연습",  desc: "긴 글을 끝까지. 호흡과 정확도." },
];

/* Mock global rankings — replaced by real data later */
const RANKINGS = {
  danmun: [
    { name: "한 보 람", best: 612, avg: 540, acc: 98.4 },
    { name: "길 길 동", best: 588, avg: 512, acc: 97.1 },
    { name: "김 민 서", best: 564, avg: 498, acc: 96.8 },
    { name: "이 서 준", best: 541, avg: 470, acc: 96.0 },
    { name: "박 지 우", best: 522, avg: 455, acc: 95.4 },
    { name: "정 하 윤", best: 504, avg: 441, acc: 94.7 },
    { name: "최 도 윤", best: 488, avg: 420, acc: 94.1 },
    { name: "강 시 우", best: 470, avg: 408, acc: 93.6 },
    { name: "윤 하 린", best: 452, avg: 394, acc: 93.0 },
    { name: "송 예 준", best: 433, avg: 380, acc: 92.4 },
    { name: "장 우 빈", best: 421, avg: 372, acc: 91.9 },
    { name: "배 시 현", best: 408, avg: 360, acc: 91.4 },
    { name: "노 다 율", best: 394, avg: 348, acc: 90.8 },
    { name: "문 라 임", best: 381, avg: 336, acc: 90.2 },
    { name: "양 시 안", best: 368, avg: 324, acc: 89.6 },
    { name: "허 가 온", best: 354, avg: 312, acc: 89.0 },
    { name: "설 다 슬", best: 341, avg: 301, acc: 88.5 },
    { name: "민 채 민", best: 328, avg: 290, acc: 87.9 },
    { name: "진 한 결", best: 314, avg: 278, acc: 87.2 },
    { name: "표 새 별", best: 300, avg: 266, acc: 86.5 },
  ],
  jangmun: [
    { name: "오 시 우", best: 548, avg: 482, acc: 97.6 },
    { name: "한 보 람", best: 521, avg: 461, acc: 96.9 },
    { name: "임 다 인", best: 503, avg: 447, acc: 96.2 },
    { name: "류 채 원", best: 487, avg: 432, acc: 95.5 },
    { name: "고 은 우", best: 472, avg: 418, acc: 94.8 },
    { name: "남 지 안", best: 456, avg: 404, acc: 94.0 },
    { name: "백 시 윤", best: 441, avg: 390, acc: 93.3 },
    { name: "조 단 우", best: 425, avg: 377, acc: 92.5 },
    { name: "권 라 온", best: 410, avg: 364, acc: 91.8 },
    { name: "전 새 봄", best: 392, avg: 348, acc: 91.0 },
    { name: "안 도 율", best: 378, avg: 336, acc: 90.4 },
    { name: "성 가 윤", best: 366, avg: 324, acc: 89.8 },
    { name: "표 시 윤", best: 353, avg: 312, acc: 89.2 },
    { name: "신 채 윤", best: 340, avg: 300, acc: 88.6 },
    { name: "공 다 온", best: 326, avg: 288, acc: 87.9 },
    { name: "방 라 율", best: 312, avg: 276, acc: 87.2 },
    { name: "구 한 슬", best: 298, avg: 264, acc: 86.5 },
    { name: "탁 시 안", best: 284, avg: 252, acc: 85.8 },
    { name: "선 가 람", best: 270, avg: 240, acc: 85.0 },
    { name: "여 새 별", best: 256, avg: 226, acc: 84.2 },
  ],
};

/* ------------------------------------------------------------------ */
/*  Mascot — smiling pencil (visible only in game theme)               */
/* ------------------------------------------------------------------ */
function PencilMascot() {
  return (
    <svg className="mascot" viewBox="0 0 96 96" width="84" height="84" aria-hidden="true">
      {/* eraser ferrule (top) */}
      <rect x="32" y="6" width="32" height="14" rx="3" fill="#ff8da1" stroke="#1f1d3a" strokeWidth="2.5"/>
      <rect x="32" y="14" width="32" height="6" fill="#c4c4c4" stroke="#1f1d3a" strokeWidth="2.5"/>
      {/* body */}
      <rect x="30" y="20" width="36" height="48" fill="#ffc83a" stroke="#1f1d3a" strokeWidth="2.5"/>
      {/* tip */}
      <polygon points="30,68 66,68 58,86 48,92 38,86" fill="#f5d29a" stroke="#1f1d3a" strokeWidth="2.5" strokeLinejoin="round"/>
      <polygon points="44,82 48,92 52,82" fill="#1f1d3a"/>
      {/* face */}
      <circle cx="42" cy="40" r="3.2" fill="#1f1d3a"/>
      <circle cx="54" cy="40" r="3.2" fill="#1f1d3a"/>
      <circle cx="43.4" cy="38.8" r="1" fill="#fff"/>
      <circle cx="55.4" cy="38.8" r="1" fill="#fff"/>
      <path d="M 41 48 Q 48 56 55 48" fill="none" stroke="#1f1d3a" strokeWidth="2.5" strokeLinecap="round"/>
      {/* cheeks */}
      <circle cx="36" cy="46" r="2.5" fill="#ff8da1" opacity="0.8"/>
      <circle cx="60" cy="46" r="2.5" fill="#ff8da1" opacity="0.8"/>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */
function Header({ screen, goHome, goTab }) {
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

/* ------------------------------------------------------------------ */
/*  Home screen                                                        */
/* ------------------------------------------------------------------ */
function HomeScreen({ goTab }) {
  const [board, setBoard] = useState("danmun");
  const rows = RANKINGS[board];

  return (
    <main data-screen-label="01 메인">
      <div className="game-banner" aria-hidden="true">
        <PencilMascot />
        <div className="greet-block">
          <div className="greet-text">오늘도 한 칸 더!</div>
          <div className="greet-sub">최고 기록을 깨면 명예의 전당에 이름을 남길 수 있어요.</div>
        </div>
        <div className="coins">
          <span className="coin-icon"></span>
          <span>2,480</span>
        </div>
      </div>

      <section className="rank-section first">
        <div className="section-head">
          <span className="roman">Ⅰ</span>
          <h2>명예의 전당</h2>
          <span className="rule" />
          <span className="section-aside">전체 랭킹 · 상위 20인</span>
        </div>

        <div className="rank-tabs" role="tablist">
          {[
            { id: "danmun",  label: "단문연습" },
            { id: "jangmun", label: "장문연습" },
          ].map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={board === t.id}
              className={"rank-tab" + (board === t.id ? " is-active" : "")}
              onClick={() => setBoard(t.id)}
            >
              {t.label}
            </button>
          ))}
          <div className="rank-tab-fill" />
        </div>

        <div className="rank-table-wrap">
          <table className="rank-table">
            <thead>
              <tr>
                <th className="col-rank">순위</th>
                <th className="col-name">이름</th>
                <th className="col-num">최고 타수</th>
                <th className="col-num">평균 타수</th>
                <th className="col-num">정확도</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const medal = i < 3 ? ["①","②","③"][i] : null;
                return (
                  <tr key={r.name} className={i < 3 ? "is-top" : ""}>
                    <td className="col-rank">
                      {medal ? <span className="medal">{medal}</span>
                             : <span className="rank-num">{i + 1}</span>}
                    </td>
                    <td className="col-name">{r.name}</td>
                    <td className="col-num">
                      <span className="big-num">{r.best}</span>
                      <span className="unit">타</span>
                    </td>
                    <td className="col-num">
                      <span className="big-num soft">{r.avg}</span>
                      <span className="unit">타</span>
                    </td>
                    <td className="col-num">
                      <span className="big-num soft">{r.acc.toFixed(1)}</span>
                      <span className="unit">%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="menu-section">
        <div className="section-head">
          <span className="roman">Ⅱ</span>
          <h2>연습 메뉴</h2>
          <span className="rule" />
        </div>

        <div className="menu-grid">
          {TABS.map((t) => (
            <button key={t.id} className="menu-card" onClick={() => goTab(t.id)}>
              <div className="num">{t.num}</div>
              <div className="ko">{t.ko}</div>
              <p className="desc">{t.desc}</p>
              <span className="arrow">→</span>
            </button>
          ))}
        </div>
      </section>

      <div className="footer-hint">
        <span>왼쪽 위 〈타자연습〉을 누르면 언제든 여기로 돌아옵니다</span>
        <span>v 0.1 · 화면 골격</span>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Practice placeholder (자리·낱말·단문·장문 공통)                       */
/* ------------------------------------------------------------------ */
function PracticeScreen({ tab }) {
  return (
    <main data-screen-label={`${tab.num} ${tab.ko}`}>
      <div className="screen-meta">
        <span className="chapter">CH. {tab.num}</span>
        <h1 className="screen-title">{tab.ko}</h1>
        <span className="screen-sub">{tab.desc}</span>
      </div>

      <div className="placeholder">
        <div className="ph-label">screen placeholder</div>
        <p className="ph-title">{tab.ko} 화면이 들어갈 자리입니다.</p>
        <p className="ph-desc">
          다음 단계에서 함께 설계해 나갈 예정이에요.
        </p>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */
function App() {
  const [screen, setScreen] = useState("home"); // "home" | tab.id
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.themeStyle = tweaks.themeStyle;
  }, [tweaks.theme, tweaks.themeStyle]);

  const goHome = () => setScreen("home");
  const goTab  = (id) => setScreen(id);

  const renderContent = () => {
    if (screen === "home") return <HomeScreen goTab={goTab} />;
    if (screen === "jari") return <JariScreen showHands={tweaks.showHands} />;
    if (screen === "natmal") return <NatmalScreen showHands={tweaks.showHands} />;
    const currentTab = TABS.find((t) => t.id === screen);
    return <PracticeScreen tab={currentTab} />;
  };

  return (
    <div className="page">
      <Header screen={screen} goHome={goHome} goTab={goTab} />
      {renderContent()}

      <TweaksPanel title="Tweaks">
        <TweakSection label="모양">
          <TweakRadio
            label="스타일"
            value={tweaks.themeStyle}
            onChange={(v) => setTweak("themeStyle", v)}
            options={[
              { value: "paper", label: "종이" },
              { value: "game",  label: "게임" },
            ]}
          />
          <TweakRadio
            label="테마"
            value={tweaks.theme}
            onChange={(v) => setTweak("theme", v)}
            options={[
              { value: "light", label: "Light" },
              { value: "dark",  label: "Dark"  },
            ]}
          />
        </TweakSection>
        <TweakSection label="연습">
          <TweakToggle
            label="손 가이드 표시"
            value={tweaks.showHands}
            onChange={(v) => setTweak("showHands", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
