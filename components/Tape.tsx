type Props = {
  values: number[];
  color?: string;
  bars?: number[];
  height?: number;
};

export function Tape({ values, color = "#c8ff63", bars, height = 120 }: Props) {
  const w = 640;
  const h = height;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const span = Math.max(max - min, 1);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = h - 8 - ((v - min) / span) * (h - 24);
    return `${x},${y}`;
  });
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${w},${h} L0,${h} Z`;
  const barMax = bars && bars.length ? Math.max(...bars, 1) : 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={height} preserveAspectRatio="none" role="img">
      {bars?.map((b, i) => {
        const bw = w / bars.length;
        const bh = (b / barMax) * (h * 0.28);
        return <rect key={i} x={i * bw + 1} y={h - bh} width={Math.max(bw - 2, 1)} height={bh} fill="#2a333c" />;
      })}
      <path d={area} fill={color} opacity="0.14" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}
