import { useState, useRef, useEffect, useId } from "react";

// 첫 진입 시 학교+이름을 받는 등록 모달(로그인 대체).
// 등록은 필수라 Esc/배경 클릭으로 닫히지 않는다.
export default function RegisterModal({ onSubmit }) {
  const [school, setSchool] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const cardRef = useRef(null);
  const firstRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  // 간단한 포커스 트랩: Tab이 카드 밖으로 나가지 않게
  const onKeyDown = (e) => {
    if (e.key !== "Tab") return;
    const focusables = cardRef.current.querySelectorAll("input, button");
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!school.trim() || !name.trim()) {
      setError("학교와 이름을 모두 적어 주세요.");
      return;
    }
    onSubmit({ school, name });
  };

  const inputStyle = {
    width: "100%",
    padding: "11px 13px",
    fontSize: 16,
    fontFamily: '"Noto Serif KR","Gowun Dodum",serif',
    color: "var(--ink)",
    background: "var(--paper)",
    border: "2px solid var(--ink)",
    borderRadius: 8,
    boxSizing: "border-box",
  };
  const labelStyle = {
    display: "block",
    fontFamily: '"IBM Plex Mono",monospace',
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--ink-faint)",
    marginBottom: 6,
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
          학교와 이름을 적어 주세요. 최고 기록을 세우면 명예의 전당에 올라가요.
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle} htmlFor={`${titleId}-school`}>학교</label>
          <input
            id={`${titleId}-school`}
            ref={firstRef}
            value={school}
            onChange={(e) => { setSchool(e.target.value); setError(""); }}
            placeholder="○○초등학교"
            style={inputStyle}
            maxLength={20}
          />
        </div>
        <div style={{ marginBottom: error ? 8 : 24 }}>
          <label style={labelStyle} htmlFor={`${titleId}-name`}>이름</label>
          <input
            id={`${titleId}-name`}
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            placeholder="홍길동"
            style={inputStyle}
            maxLength={12}
          />
        </div>

        {error && (
          <div role="alert" style={{ color: "var(--stamp)", fontSize: 13, marginBottom: 18, fontFamily: '"Noto Serif KR","Gowun Dodum",serif' }}>
            {error}
          </div>
        )}

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
