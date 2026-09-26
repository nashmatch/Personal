import { format, startOfDay, endOfDay, parseISO } from "date-fns";

export function dayKey(date: Date | string = new Date()) {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "yyyy-MM-dd");
}

export function dayRange(dateStr: string) {
  const d = parseISO(dateStr);
  return { gte: startOfDay(d), lte: endOfDay(d) };
}

export function todayKey() {
  return dayKey(new Date());
}
