export default function Sparkline({ values }: { values: number[] }) {
  const w = 160;
  const h = 34;
  if (values.length < 2) return <svg className="spark" viewBox={`0 0 ${w} ${h}`} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={`${d} L${w} ${h} L0 ${h} Z`} className="spark-area" />
      <path d={d} className="spark-line" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r={2.5} className="spark-dot" />
    </svg>
  );
}
