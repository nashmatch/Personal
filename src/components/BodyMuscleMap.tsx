"use client";

import { useState } from "react";
import { volumeColor } from "@/lib/muscles";

interface Region {
  muscle: string;
  view: "front" | "back";
  shape: "rect" | "circle";
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number;
  rx?: number;
}

const REGIONS: Region[] = [
  // ---- front ----
  { muscle: "Neck", view: "front", shape: "rect", x: 92, y: 46, w: 16, h: 16, rx: 5 },
  { muscle: "Shoulders", view: "front", shape: "circle", x: 55, y: 74, r: 15 },
  { muscle: "Shoulders", view: "front", shape: "circle", x: 145, y: 74, r: 15 },
  { muscle: "Chest", view: "front", shape: "rect", x: 65, y: 65, w: 70, h: 48, rx: 14 },
  { muscle: "Biceps", view: "front", shape: "rect", x: 34, y: 86, w: 18, h: 44, rx: 8 },
  { muscle: "Biceps", view: "front", shape: "rect", x: 148, y: 86, w: 18, h: 44, rx: 8 },
  { muscle: "Forearms", view: "front", shape: "rect", x: 29, y: 132, w: 16, h: 44, rx: 8 },
  { muscle: "Forearms", view: "front", shape: "rect", x: 155, y: 132, w: 16, h: 44, rx: 8 },
  { muscle: "Abdominals", view: "front", shape: "rect", x: 72, y: 114, w: 56, h: 54, rx: 10 },
  { muscle: "Abductors", view: "front", shape: "rect", x: 58, y: 178, w: 12, h: 48, rx: 6 },
  { muscle: "Abductors", view: "front", shape: "rect", x: 130, y: 178, w: 12, h: 48, rx: 6 },
  { muscle: "Adductors", view: "front", shape: "rect", x: 90, y: 178, w: 20, h: 40, rx: 8 },
  { muscle: "Quadriceps", view: "front", shape: "rect", x: 68, y: 172, w: 27, h: 68, rx: 12 },
  { muscle: "Quadriceps", view: "front", shape: "rect", x: 105, y: 172, w: 27, h: 68, rx: 12 },
  { muscle: "Calves", view: "front", shape: "rect", x: 70, y: 248, w: 22, h: 54, rx: 10 },
  { muscle: "Calves", view: "front", shape: "rect", x: 108, y: 248, w: 22, h: 54, rx: 10 },

  // ---- back ----
  { muscle: "Traps", view: "back", shape: "rect", x: 76, y: 46, w: 48, h: 28, rx: 12 },
  { muscle: "Shoulders", view: "back", shape: "circle", x: 55, y: 74, r: 15 },
  { muscle: "Shoulders", view: "back", shape: "circle", x: 145, y: 74, r: 15 },
  { muscle: "Triceps", view: "back", shape: "rect", x: 34, y: 86, w: 18, h: 44, rx: 8 },
  { muscle: "Triceps", view: "back", shape: "rect", x: 148, y: 86, w: 18, h: 44, rx: 8 },
  { muscle: "Lats", view: "back", shape: "rect", x: 61, y: 78, w: 27, h: 62, rx: 12 },
  { muscle: "Lats", view: "back", shape: "rect", x: 112, y: 78, w: 27, h: 62, rx: 12 },
  { muscle: "Middle Back", view: "back", shape: "rect", x: 88, y: 82, w: 24, h: 46, rx: 10 },
  { muscle: "Lower Back", view: "back", shape: "rect", x: 82, y: 130, w: 36, h: 32, rx: 10 },
  { muscle: "Forearms", view: "back", shape: "rect", x: 29, y: 132, w: 16, h: 44, rx: 8 },
  { muscle: "Forearms", view: "back", shape: "rect", x: 155, y: 132, w: 16, h: 44, rx: 8 },
  { muscle: "Glutes", view: "back", shape: "rect", x: 70, y: 164, w: 28, h: 36, rx: 14 },
  { muscle: "Glutes", view: "back", shape: "rect", x: 102, y: 164, w: 28, h: 36, rx: 14 },
  { muscle: "Hamstrings", view: "back", shape: "rect", x: 68, y: 202, w: 28, h: 48, rx: 12 },
  { muscle: "Hamstrings", view: "back", shape: "rect", x: 104, y: 202, w: 28, h: 48, rx: 12 },
  { muscle: "Calves", view: "back", shape: "rect", x: 70, y: 252, w: 22, h: 54, rx: 10 },
  { muscle: "Calves", view: "back", shape: "rect", x: 108, y: 252, w: 22, h: 54, rx: 10 },
];

export function BodyMuscleMap({
  data,
  onSelectMuscle,
}: {
  data: Record<string, number>; // muscle -> ratio 0..1
  onSelectMuscle?: (muscle: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap justify-center gap-8">
      <BodyView view="front" label="Front" data={data} hover={hover} setHover={setHover} onSelectMuscle={onSelectMuscle} />
      <BodyView view="back" label="Back" data={data} hover={hover} setHover={setHover} onSelectMuscle={onSelectMuscle} />
    </div>
  );
}

function BodyView({
  view,
  label,
  data,
  hover,
  setHover,
  onSelectMuscle,
}: {
  view: "front" | "back";
  label: string;
  data: Record<string, number>;
  hover: string | null;
  setHover: (m: string | null) => void;
  onSelectMuscle?: (muscle: string) => void;
}) {
  const regions = REGIONS.filter((r) => r.view === view);
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 320" width={160} height={256}>
        {/* silhouette */}
        <circle cx={100} cy={30} r={18} fill="var(--text-muted)" opacity={0.22} />
        <rect x={78} y={58} width={44} height={16} rx={8} fill="var(--text-muted)" opacity={0.22} />
        <rect x={45} y={62} width={110} height={130} rx={30} fill="var(--text-muted)" opacity={0.14} />
        <rect x={62} y={168} width={76} height={140} rx={20} fill="var(--text-muted)" opacity={0.14} />

        {regions.map((r, i) => {
          const ratio = data[r.muscle] ?? 0;
          const isHover = hover === r.muscle;
          const fill = ratio > 0 ? volumeColor(ratio) : "var(--text-muted)";
          const commonProps = {
            fill,
            opacity: ratio > 0 ? (isHover ? 1 : 0.92) : isHover ? 0.55 : 0.3,
            stroke: isHover ? "var(--text-primary)" : "transparent",
            strokeWidth: 1.5,
            className: "cursor-pointer transition-all",
            onMouseEnter: () => setHover(r.muscle),
            onMouseLeave: () => setHover(null),
            onClick: () => onSelectMuscle?.(r.muscle),
          };
          if (r.shape === "circle") {
            return <circle key={i} {...commonProps} cx={r.x} cy={r.y} r={r.r} />;
          }
          return <rect key={i} {...commonProps} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} />;
        })}
      </svg>
      <p className="mt-1 text-xs font-medium text-muted">{label}</p>
      {hover && (
        <p className="text-xs text-secondary">
          {hover} · {Math.round((data[hover] ?? 0) * 100)}% of max
        </p>
      )}
    </div>
  );
}
