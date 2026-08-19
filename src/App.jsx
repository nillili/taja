import { useState, useEffect, useRef } from "react";
import Header from "./components/Header.jsx";
import StyleSwitch from "./components/StyleSwitch.jsx";
import RegisterModal from "./components/RegisterModal.jsx";
import HomeScreen from "./screens/HomeScreen.jsx";
import JariScreen from "./screens/JariScreen.jsx";
import NatmalScreen from "./screens/NatmalScreen.jsx";
import DanmunScreen from "./screens/DanmunScreen.jsx";
import PlaceholderScreen from "./screens/PlaceholderScreen.jsx";
import AdminScreen from "./screens/AdminScreen.jsx";
import { TABS } from "./data/tabs.js";
import { getUser, saveUser, updateBestIfHigher } from "./data/user.js";
import { saveRecord, getWords, getSentences, invalidateSentences } from "./data/api.js";
import { setWordSource } from "./data/wordSteps.js";

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

  // 낱말 데이터는 D1이 원본 — 앱 시작 때 받아 출제 데이터로 쓴다.
  // (실패하면 wordSteps.js 내장 데이터가 그대로 유지된다)
  useEffect(() => { getWords().then(setWordSource); }, []);

  // 단문 데이터도 D1이 원본. 낱말과 달리 여기(App)가 상태로 들고 있다가 화면에 내려준다 —
  // 그래야 관리 화면에서 문장을 바꿨을 때 이미 열려 있는 연습 화면도 새 문장을 받는다.
  const [danmun, setDanmun] = useState({ levels: null, loading: true });
  useEffect(() => {
    let alive = true;
    getSentences().then((r) => { if (alive) setDanmun({ levels: r.levels, loading: false }); });
    return () => { alive = false; };
  }, []);
  const reloadDanmun = async () => {
    invalidateSentences();
    const r = await getSentences();
    setDanmun({ levels: r.levels, loading: false });
  };

  // 연습 완료 → 기록 자동 저장 (비동기, 실패해도 앱 흐름 안 막음)
  // 개인 최고 갱신 여부는 localStorage에 기록 → DoneOverlay 뱃지 표시용
  const [saveState, setSaveState] = useState(null);   // null | saving | saved | failed
  const lastPayload = useRef(null);

  const sendRecord = (payload) => {
    setSaveState("saving");
    saveRecord(payload).then((r) => setSaveState(r && r.ok ? "saved" : "failed"));
  };

  const handleDone = (result) => {
    if (!result || result.wpm === 0) return;
    // 개인 최고 갱신 여부 저장 (DoneOverlay가 직접 참조)
    updateBestIfHigher(result);
    if (!user) return;
    // 단문·장문은 board를 그대로 보내면 서버가 오늘 기록과 명예의전당에 한 번에 남긴다.
    // (요청을 두 번 보내면 한쪽만 성공하는 상태가 생긴다)
    const payload = {
      board: result.screen === "danmun" ? "danmun" : "today",
      name: user.name,
      school: user.school,
      wpm: result.wpm,
      acc: result.acc,
      screen: result.screen,
      step: result.step,
      mode: result.mode ?? null,
    };
    lastPayload.current = payload;
    sendRecord(payload);
  };
  const retrySave = () => { if (lastPayload.current) sendRecord(lastPayload.current); };

  const goHome = () => { setScreen("home"); setPracticeNav(null); setSaveState(null); };
  const goTab = (id) => { setScreen(id); setPracticeNav(null); setSaveState(null); };
  const handleNext = (next) => {
    setSaveState(null);
    if (next.screen === "natmal") {
      setPracticeNav({ screen: "natmal", step: next.step, mode: next.mode });
      setScreen("natmal");
    } else if (next.screen === "danmun") {
      setPracticeNav({ screen: "danmun", step: next.step, mode: null });
      setScreen("danmun");
    }
  };

  const renderContent = () => {
    if (screen === "home") return <HomeScreen goTab={goTab} user={user} />;
    if (screen === "jari") return (
      <JariScreen onDone={handleDone} onNext={handleNext} />
    );
    if (screen === "natmal") {
      const nav = practiceNav?.screen === "natmal" ? practiceNav : null;
      return (
        <NatmalScreen
          key={nav ? `${nav.step}-${nav.mode}` : "default"}
          initialStep={nav?.step ?? 1}
          initialMode={nav?.mode ?? "basic"}
          onDone={handleDone}
          onNext={handleNext}
        />
      );
    }
    if (screen === "danmun") {
      const nav = practiceNav?.screen === "danmun" ? practiceNav : null;
      return (
        <DanmunScreen
          key={nav ? `danmun-${nav.step}` : "danmun"}
          initialStep={nav?.step ?? 1}
          levels={danmun.levels}
          loading={danmun.loading}
          onDone={handleDone}
          onNext={handleNext}
          saveState={saveState}
          onRetrySave={retrySave}
        />
      );
    }
    if (screen === "admin") return <AdminScreen onSentencesChanged={reloadDanmun} />;
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
