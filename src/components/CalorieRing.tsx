export function CalorieRing({
  consumed,
  target,
  size = 160,
}: {
  consumed: number;
  target: number;
  size?: number;
}) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = target > 0 ? consumed / target : 0;
  const clamped = Math.min(ratio, 1);
  const over = ratio > 1;
  const color = over ? "var(--status-warning)" : "var(--accent-blue)";
  const remaining = Math.round(target - consumed);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-sunken)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-semibold tabular-nums">{Math.round(consumed)}</span>
        <span className="text-xs text-muted">of {Math.round(target)} kcal</span>
        <span className={`mt-1 text-xs font-medium ${over ? "text-status-warning" : "text-accent-aqua"}`}>
          {over ? `${Math.abs(remaining)} over` : `${remaining} left`}
        </span>
      </div>
    </div>
  );
}

export function MacroBar({
  label,
  color,
  consumed,
  target,
  unit = "g",
}: {
  label: string;
  color: string;
  consumed: number;
  target: number;
  unit?: string;
}) {
  const ratio = target > 0 ? Math.min(consumed / target, 1) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium text-secondary">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className="tabular-nums text-muted">
          {Math.round(consumed)}
          {unit} / {Math.round(target)}
          {unit}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-sunken">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${ratio * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}
