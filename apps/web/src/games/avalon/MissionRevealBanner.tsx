interface MissionRevealBannerProps {
  failCount: number;
  onContinue: () => void;
}

export function MissionRevealBanner({ failCount, onContinue }: MissionRevealBannerProps) {
  return (
    <div className="card uc-ended-banner">
      <h3 style={{ marginTop: 0 }}>任务结果揭晓</h3>
      <p>本轮出现 {failCount} 张失败牌</p>
      <button type="button" className="btn" onClick={onContinue}>
        继续
      </button>
    </div>
  );
}
