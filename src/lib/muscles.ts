// Canonical muscle groups (matches the seeded free-exercise-db dataset).
export const MUSCLE_GROUPS = [
  "Abdominals",
  "Abductors",
  "Adductors",
  "Biceps",
  "Calves",
  "Chest",
  "Forearms",
  "Glutes",
  "Hamstrings",
  "Lats",
  "Lower Back",
  "Middle Back",
  "Neck",
  "Quadriceps",
  "Shoulders",
  "Traps",
  "Triceps",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

// Sequential blue ramp (light -> dark = low -> high volume), per the app's
// data-viz palette. Used to color the muscle heatmap by training volume.
const SEQ_STEPS = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];

export function volumeColor(ratio: number) {
  // ratio in [0, 1] -> pick a step, clamping into range.
  const idx = Math.round(Math.min(Math.max(ratio, 0), 1) * (SEQ_STEPS.length - 1));
  return SEQ_STEPS[idx];
}
