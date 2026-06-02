import { useState, useEffect } from "react";
import Header from "./components/Header.jsx";
import StyleSwitch from "./components/StyleSwitch.jsx";
import RegisterModal from "./components/RegisterModal.jsx";
import HomeScreen from "./screens/HomeScreen.jsx";
import JariScreen from "./screens/JariScreen.jsx";
import NatmalScreen from "./screens/NatmalScreen.jsx";
import PlaceholderScreen from "./screens/PlaceholderScreen.jsx";
import { TABS } from "./data/tabs.js";
import { getUser, saveUser, updateBestIfHigher } from "./data/user.js";
import { saveRecord } from "./data/api.js";

const STYLE_KEY = "typing.themeStyle.v1";

export default function App() {
  const [screen, setScreen] = useState("home");
  const [practiceNav, setPracticeNav] = useState(null);
  const [user, setUser] = useState(() => getUser());
  const [themeStyle, setThemeStyle] = useState(
    () => localStorage.getItem(STYLE_KEY) || "game"
  );

  useEffect(() => {
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.themeStyle = themeStyle;
    localStorage.setItem(STYLE_KEY, themeStyle);
  }, [themeStyle]);

  const [vh, setVh] = useState(null);
  useEffect(() => {
    const measure = () => setVh(document.documentElement.clientHeight);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // 연습 완료 → "오늘" 기록 자동 저장 (비동기, 실패해도 앱 흐름 안 막음)
  // 개인 최고 갱신 여부는 localStorage에 기록 → DoneOverlay 뱃지 표시용
  const handleDone = (result) => {
    if (!result || result.wpm === 0) return;
    // 개인 최고 갱신 여부 저장 (DoneOverlay가 직접 참조)
    updateBestIfHigher(result);
    // 오늘 기록 D1 저장 (사용자 등록돼 있을 때만)
    if (user) {
      saveRecord({
        board: "today",
        name: user.name,
        school: user.school,
        wpm: result.wpm,
        acc: result.acc,
        screen: result.screen,
        step: result.step,
        mode: result.mode ?? null,
      });
    }
  };

  const goHome = () => { setScreen("home"); setPracticeNav(null); };
  const goTab = (id) => { setScreen(id); setPracticeNav(null); };
  const handleNext = (next) => {
    if (next.screen === "natmal") {
      setPracticeNav({ step: next.step, mode: next.mode });
      setScreen("natmal");
    }
  };

  const renderContent = () => {
    if (screen === "home") return <HomeScreen goTab={goTab} user={user} />;
    if (screen === "jari") return (
      <JariScreen onDone={handleDone} onNext={handleNext} />
    );
    if (screen === "natmal") return (
      <NatmalScreen
        key={practiceNav ? `${practiceNav.step}-${practiceNav.mode}` : "default"}
        initialStep={practiceNav?.step ?? 1}
        initialMode={practiceNav?.mode ?? "basic"}
        onDone={handleDone}
        onNext={handleNext}
      />
    );
    const currentTab = TABS.find((t) => t.id === screen);
    return <PlaceholderScreen tab={currentTab} />;
  };

  return (
    <div className="page" style={vh ? { height: vh } : undefined}>
      <Header screen={screen} goHome={goHome} goTab={goTab} />
      {renderContent()}
      <StyleSwitch value={themeStyle} onChange={setThemeStyle} />
      {!user && <RegisterModal onSubmit={(data) => setUser(saveUser(data))} />}
    </div>
  );
}
