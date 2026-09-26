"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Apple, Dumbbell, CalendarRange, Target, ArrowRight } from "lucide-react";
import { Card, SectionHeading, Badge } from "@/components/ui";
import { CalorieRing, MacroBar } from "@/components/CalorieRing";

interface Summary {
  totals: { calories: number; proteinG: number; carbsG: number; fatG: number };
  goal: { calories: number; proteinG: number; carbsG: number; fatG: number } | null;
  mealCount: number;
  workoutCount: number;
}

interface WorkoutLog {
  id: string;
  name: string;
  date: string;
  sets: { exercise: { name: string } }[];
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutLog[]>([]);

  useEffect(() => {
    fetch("/api/summary")
      .then((r) => r.json())
      .then(setSummary);
    fetch("/api/workout-logs?take=3")
      .then((r) => r.json())
      .then((d) => setRecentWorkouts(d.logs ?? []));
  }, []);

  const g = summary?.goal ?? { calories: 2200, proteinG: 160, carbsG: 220, fatG: 70 };
  const totals = summary?.totals ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

  return (
    <div>
      <SectionHeading
        title={`Good ${partOfDay()}`}
        subtitle={format(new Date(), "EEEE, MMMM d")}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-[auto_1fr]">
        <Card className="flex items-center justify-center">
          <CalorieRing consumed={totals.calories} target={g.calories} />
        </Card>
        <Card className="flex flex-col justify-center gap-4">
          <MacroBar label="Protein" color="var(--accent-blue)" consumed={totals.proteinG} target={g.proteinG} />
          <MacroBar label="Carbs" color="var(--accent-orange)" consumed={totals.carbsG} target={g.carbsG} />
          <MacroBar label="Fat" color="var(--accent-aqua)" consumed={totals.fatG} target={g.fatG} />
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <QuickLink href="/nutrition" icon={Apple} label="Log a meal" />
        <QuickLink href="/workouts" icon={Dumbbell} label="Log a workout" />
        <QuickLink href="/meal-plan" icon={CalendarRange} label="Plan meals" />
        <QuickLink href="/goals" icon={Target} label="Set goals" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium">Today</h3>
            <Link href="/nutrition" className="text-xs font-medium text-accent-blue hover:underline">
              View log
            </Link>
          </div>
          <div className="flex gap-4 text-sm">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{summary?.mealCount ?? 0}</p>
              <p className="text-xs text-muted">meals logged</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{summary?.workoutCount ?? 0}</p>
              <p className="text-xs text-muted">workouts done</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium">Recent workouts</h3>
            <Link href="/workouts" className="text-xs font-medium text-accent-blue hover:underline">
              View all
            </Link>
          </div>
          {recentWorkouts.length === 0 ? (
            <p className="text-sm text-muted">No workouts logged yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentWorkouts.map((w) => (
                <li key={w.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{w.name}</p>
                    <p className="text-xs text-muted">{format(new Date(w.date), "MMM d")}</p>
                  </div>
                  <Badge>{w.sets.length} sets</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}) {
  return (
    <Link href={href} className="card group flex items-center justify-between p-4 hover:bg-card-hover">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-blue/10 text-accent-blue">
          <Icon size={16} />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <ArrowRight size={14} className="text-muted transition group-hover:translate-x-0.5" />
    </Link>
  );
}

function partOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}
