import { useState, useEffect } from "react";
import { TABS } from "../data/tabs.js";
import PencilMascot from "../components/PencilMascot.jsx";
import { fetchRecords } from "../data/api.js";

// 메인: 인사 배너(게임 테마) + 명예의 전당("오늘" 통합 랭킹) + 연습 메뉴
// 랭킹 실제 데이터 연동은 후속 단계(API). 지금은 빈 상태를 보여준다.
export default function HomeScreen({ goTab, user = null }) {
  const greet = user ? `${user.name}님, 오늘도 한 칸 더!` : "오늘도 한 칸 더!";
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchRecords("today").then((data) => {
      if (!cancelled) {
        setRecords(data.length > 0 ? data : null);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);
  return (
    <main data-screen-label="01 메인">
      <div className="main-inner">
        <div className="game-banner" aria-hidden="true">
          <PencilMascot />
          <div className="greet-block">
            <div className="greet-text">{greet}</div>
            <div className="greet-sub">최고 기록을 깨면 명예의 전당에 이름을 남길 수 있어요.</div>
          </div>
        </div>

        <section className="rank-section first">
          <div className="section-head">
            <span className="roman">Ⅰ</span>
            <h2>명예의 전당</h2>
            <span className="rule" />
            <span className="section-aside">오늘의 기록</span>
          </div>

          <div className="rank-tabs" role="tablist">
            <button role="tab" aria-selected="true" className="rank-tab is-active">오늘</button>
            <div className="rank-tab-fill" />
          </div>

          <div className="rank-table-wrap">
            <table className="rank-table">
              <thead>
                <tr>
                  <th className="col-rank">순위</th>
                  <th className="col-name">이름 · 학교</th>
                  <th className="col-num">최고 타수</th>
                  <th className="col-num">정확도</th>
                </tr>
              </thead>
              <tbody>
                {records && records.length > 0 ? (
                  records.map((r, i) => {
                    const medal = i < 3 ? ["①", "②", "③"][i] : null;
                    return (
                      <tr key={i} className={i < 3 ? "is-top" : ""}>
                        <td className="col-rank">
                          {medal ? <span className="medal">{medal}</span> : <span className="rank-num">{i + 1}</span>}
                        </td>
                        <td className="col-name">
                          {r.name}
                          {r.school ? <span className="col-school"> · {r.school}</span> : null}
                        </td>
                        <td className="col-num"><span className="big-num">{r.wpm}</span><span className="unit">타</span></td>
                        <td className="col-num"><span className="big-num soft">{r.acc}</span><span className="unit">%</span></td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4}>
                      <div className="rank-empty">
                        {loading ? "기록을 불러오는 중…" : "아직 기록이 없어요. 첫 주인공이 되어 보세요!"}
                      </div>
                    </td>
                  </tr>
                )}
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
          <span>v 0.1</span>
        </div>
      </div>
    </main>
  );
}
