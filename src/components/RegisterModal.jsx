import { useState, useRef, useEffect, useId } from "react";

const RANDOM_NAMES = [
  "초롱이", "하늘이", "도도", "뭉치", "나비",
  "루루", "콩이", "별이", "솜이", "단이",
  "두루미", "파랑새", "달달이", "구름이", "해님",
  "보리", "쑥이", "다래", "모래", "노을이",
];

function randomName() {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
}

const DEFAULT_SCHOOL = "우리초등학교";

export default function RegisterModal({ onSubmit }) {
  const [school, setSchool] = useState("");
  const [name, setName] = useState("");
  const cardRef = useRef(null);
  const firstRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  // 포커스 트랩
  const onKeyDown = (e) => {
    if (e.key !== "Tab") return;
    const focusables = cardRef.current.querySelectorAll("input, button");
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  };

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      school: school.trim() || DEFAULT_SCHOOL,
      name: name.trim() || randomName(),
    });
  };

  const inputStyle = {
    width: "100%", padding: "11px 13px", fontSize: 16,
    fontFamily: '"Noto Serif KR","Gowun Dodum",serif',
    color: "var(--ink)", background: "var(--paper)",
    border: "2px solid var(--ink)", borderRadius: 8, boxSizing: "border-box",
  };
  const labelStyle = {
    display: "block", fontFamily: '"IBM Plex Mono",monospace',
    fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
    color: "var(--ink-faint)", marginBottom: 6,
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.28)", backdropFilter: "blur(3px)", zIndex: 100 }}
      onKeyDown={onKeyDown}
    >
      <form
        ref={cardRef}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ background: "var(--paper)", border: "2.5px solid var(--ink)", borderRadius: 14, padding: "32px 36px", boxShadow: "7px 7px 0 var(--ink)", width: 360, maxWidth: "calc(100vw - 32px)" }}
      >
        <div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: "var(--accent)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8 }}>
          반가워요
        </div>
        <h2 id={titleId} style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, fontFamily: '"Noto Serif KR","Jua",serif' }}>
          사용자 등록
        </h2>
        <p style={{ margin: "0 0 22px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          학교와 이름을 적어 주세요.<br />
          비워두면 랜덤 이름으로 시작해요.
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle} htmlFor={`${titleId}-school`}>학교</label>
          <input
            id={`${titleId}-school`}
            ref={firstRef}
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            placeholder={DEFAULT_SCHOOL}
            style={inputStyle}
            maxLength={20}
          />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle} htmlFor={`${titleId}-name`}>이름</label>
          <input
            id={`${titleId}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="비워두면 랜덤 이름"
            style={inputStyle}
            maxLength={12}
          />
        </div>

        <button
          type="submit"
          style={{ width: "100%", padding: "13px 0", border: "2px solid var(--ink)", background: "var(--accent)", color: "#fff", fontFamily: '"Noto Serif KR","Jua",serif', fontSize: 17, fontWeight: 700, cursor: "pointer", borderRadius: 8 }}
        >
          시작하기
        </button>
      </form>
    </div>
  );
}
