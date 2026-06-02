// 아직 구현 전 화면(단문/장문, 그리고 골격 단계의 자리/낱말)을 위한 자리표시
export default function PlaceholderScreen({ tab }) {
  return (
    <main data-screen-label={`${tab.num} ${tab.ko}`}>
      <div className="main-inner">
        <div className="screen-meta">
          <span className="chapter">CH. {tab.num}</span>
          <h1 className="screen-title">{tab.ko}</h1>
          <span className="screen-sub">{tab.desc}</span>
        </div>

        <div className="placeholder">
          <div className="ph-label">screen placeholder</div>
          <p className="ph-title">{tab.ko} 화면이 들어갈 자리입니다.</p>
          <p className="ph-desc">다음 단계에서 함께 만들어 나갈 예정이에요.</p>
        </div>
      </div>
    </main>
  );
}
