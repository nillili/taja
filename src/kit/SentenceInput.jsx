// SentenceInput.jsx — 단문/장문의 "내가 쓴 글" 입력칸.
//
// 자리·낱말연습은 window keydown을 preventDefault로 가로채 키 하나씩 판정하지만,
// 단문은 실제 <input>에 한글 IME로 받아 글자 단위로 비교한다.
// (그래야 띄어쓰기 오류까지 보이고, 백스페이스로 고칠 수 있다)
//
// 생김새는 TypedBox와 똑같이 맞춘다 — 학생이 보기에 "여기서만 다른 칸"이면 안 된다.
// 보이지 않는 진짜 input을 위에 덮고, 그 아래에 색칠한 글자를 그린다.

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const SentenceInput = forwardRef(function SentenceInput(
  { value = "", cells = [], disabled = false, hint = "", label = "내가 쓴 글",
    focusKey = 0,   // 이 값이 바뀌면 다시 포커스를 가져온다 (문장 넘김·다시 시작·단계 변경)
    onChange, onComposingChange, onSubmit },
  ref
) {
  const inputRef = useRef(null);
  const viewRef = useRef(null);
  const composingRef = useRef(false);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }), []);

  // 들어오자마자 바로 칠 수 있어야 한다.
  // 부모가 focus()를 불러 주는 방식은 "언제 부르느냐"에 기대게 되고,
  // 아직 disabled인 순간에 부르면 조용히 무시된다(disabled 요소는 포커스를 못 받는다).
  // 그래서 입력이 가능해지는 순간과 문장이 바뀌는 순간에 스스로 가져온다.
  useEffect(() => {
    if (disabled) return;
    const el = inputRef.current;
    if (!el || document.activeElement === el) return;
    el.focus();
  }, [disabled, focusKey]);

  // 안전망: 포커스가 어디에도 없는데 학생이 타자를 치기 시작하면 입력칸으로 데려온다.
  // (버튼에 포커스가 있을 때는 건드리지 않는다 — Tab으로 단계·키보드 버튼을 쓰는 걸 막으면 안 된다)
  useEffect(() => {
    if (disabled) return;
    const on = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const el = inputRef.current;
      const active = document.activeElement;
      if (!el || active === el) return;
      const tag = active && active.tagName;
      if (tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA" || tag === "A") return;
      el.focus();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [disabled]);

  // 길어지면 방금 친 글자가 보이도록 끝으로 스크롤 (TypedBox와 같은 동작)
  useEffect(() => {
    const el = viewRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [value]);

  const setComposing = (on) => {
    composingRef.current = on;
    onComposingChange?.(on);
  };

  // 커서는 언제나 문장 끝에 둔다.
  // 마우스로 가운데를 눌러 커서가 안쪽에 놓이면 실제 입력 위치와 우리가 그린 캐럿이
  // 어긋나 학생이 혼란스럽다. 단, 조합 중에는 절대 건드리지 않는다(조합이 깨진다).
  const keepCaretAtEnd = (e) => {
    if (composingRef.current) return;
    const el = e.currentTarget;
    const end = el.value.length;
    if (el.selectionStart !== end || el.selectionEnd !== end) {
      el.setSelectionRange(end, end);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;
    // 조합 중 Enter는 IME가 글자를 확정하는 신호다. 여기서 제출하면
    // 마지막 글자가 빠진 채로 채점된다. (Windows MS IME에서 특히 자주 걸린다)
    if (e.nativeEvent.isComposing || e.keyCode === 229 || composingRef.current) return;
    if (e.repeat) return;                 // Enter를 꾹 눌러도 한 번만
    e.preventDefault();
    onSubmit?.();
  };

  return (
    <div className="sent-input" onPointerDown={() => inputRef.current?.focus()}>
      <label className="sent-input-label" htmlFor="danmun-input">{label}</label>

      <div className="sent-input-box">
        <input
          id="danmun-input"
          ref={inputRef}
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={(e) => {
            // 조합이 끝난 값까지 함께 반영한다 — 브라우저에 따라 change가 늦게 온다
            setComposing(false);
            onChange?.(e.currentTarget.value);
          }}
          onKeyDown={handleKeyDown}
          onSelect={keepCaretAtEnd}
          onClick={keepCaretAtEnd}
          onPaste={(e) => e.preventDefault()}   // 정답 붙여넣기 방지
          onDrop={(e) => e.preventDefault()}
          onCopy={(e) => e.preventDefault()}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          aria-describedby="danmun-hint"
          className="sent-input-real"
        />

        <div className="sent-input-view" ref={viewRef} aria-hidden="true">
          {cells.map((c, i) => {
            if (c.state === "pending") return null;   // 안 친 글자는 위 본보기에만 있다
            if (c.ch === " ") return <span key={i} className={`sc sc-space sc-${c.state}`} />;
            return <span key={i} className={`sc sc-${c.state}`}>{c.ch}</span>;
          })}
          {!disabled && <span className="typed-caret" />}
        </div>
      </div>

      <div id="danmun-hint" className="sent-input-hint" role="status" aria-live="polite">
        {hint}
      </div>
    </div>
  );
});

export default SentenceInput;
