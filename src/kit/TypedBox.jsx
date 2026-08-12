// TypedBox.jsx — "내가 쓴 글": 지금까지 입력한 내용을 입력칸처럼 보여준다.
//
//   자리연습 · 낱말연습 : <TypedBox text={...} />                 짧게, 가운데 정렬
//   단문연습 · 장문연습 : <TypedBox text={...} align="left" width="100%" />
//                        한 문장이 들어가야 하므로 넓게, 왼쪽 정렬
//
// 자리·낱말은 한 자(한 낱말)를 성공하면 화면 쪽에서 text를 비운다.
// 칸에 한 단위만 담기므로 가운데 정렬이어도 글이 밀려 보이지 않는다.

import { useEffect, useRef } from "react";

const JUSTIFY = { left: "flex-start", center: "center", right: "flex-end" };

export default function TypedBox({
  text = "",
  align = "center",
  width = 280,
  label = "내가 쓴 글",
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = el.scrollWidth; // 길어지면 끝(방금 친 글자)이 보이게
  }, [text]);

  return (
    <div style={{ width, maxWidth: "100%", flexShrink: 0 }}>
      {label && (
        <div style={{
          fontFamily: '"IBM Plex Mono",monospace', fontSize: 10, letterSpacing: "0.14em",
          color: "var(--ink-faint)", marginBottom: 4,
          textAlign: align === "left" ? "left" : "center", // 라벨은 칸 전체의 제목이라 가운데
        }}>
          {label}
        </div>
      )}
      <div
        ref={ref}
        style={{
          height: 46, boxSizing: "border-box", padding: "0 12px",
          display: "flex", alignItems: "center",
          justifyContent: JUSTIFY[align] || "flex-end",
          borderRadius: 10, border: "2px solid var(--rule)", background: "var(--paper)",
          overflow: "hidden", whiteSpace: "nowrap",
          fontFamily: '"Noto Serif KR","Jua",serif', fontSize: 22, lineHeight: 1,
          color: "var(--ink)", userSelect: "none",
        }}
      >
        <span style={{ flexShrink: 0 }}>{text}</span>
        <span className="typed-caret" />
      </div>
    </div>
  );
}
