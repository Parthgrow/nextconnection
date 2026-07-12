import type { Contact } from "@/lib/contact";

export type DayCounts = Map<string, number>;

export type ApplicationStats = {
  today: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
  total: number;
  currentStreak: number;
  longestStreak: number;
};

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (d.getDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  return addDays(d, -mondayOffset);
}

// Day-count map keyed by appliedDate ("YYYY-MM-DD") — the single source of
// truth every other stat (and future visualizations like a contribution
// heatmap) derives from.
export function buildDayCounts(contacts: Contact[]): DayCounts {
  const counts: DayCounts = new Map();
  for (const contact of contacts) {
    if (!contact.appliedDate) continue;
    counts.set(contact.appliedDate, (counts.get(contact.appliedDate) ?? 0) + 1);
  }
  return counts;
}

function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function computeStreaks(
  dayCounts: DayCounts,
  today: Date
): { currentStreak: number; longestStreak: number } {
  const activeDays = [...dayCounts.keys()].sort();
  if (activeDays.length === 0) return { currentStreak: 0, longestStreak: 0 };

  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < activeDays.length; i++) {
    run = dayNumber(activeDays[i]) - dayNumber(activeDays[i - 1]) === 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }

  const activeSet = new Set(activeDays);
  // A streak stays alive if today hasn't been logged yet but yesterday was —
  // "today" isn't over, so it's a pending day rather than a broken streak.
  let anchor = today;
  if (!activeSet.has(toDateKey(anchor))) {
    anchor = addDays(anchor, -1);
    if (!activeSet.has(toDateKey(anchor))) return { currentStreak: 0, longestStreak };
  }

  let currentStreak = 0;
  let cursor = anchor;
  while (activeSet.has(toDateKey(cursor))) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  return { currentStreak, longestStreak };
}

export function computeStats(contacts: Contact[], today: Date = new Date()): ApplicationStats {
  const dayCounts = buildDayCounts(contacts);
  const todayKey = toDateKey(today);

  const weekStart = startOfWeek(today);
  let thisWeek = 0;
  for (let i = 0; i < 7; i++) {
    thisWeek += dayCounts.get(toDateKey(addDays(weekStart, i))) ?? 0;
  }

  let thisMonth = 0;
  let thisYear = 0;
  let total = 0;
  for (const [key, count] of dayCounts) {
    total += count;
    const [y, m] = key.split("-").map(Number);
    if (y === today.getFullYear()) {
      thisYear += count;
      if (m === today.getMonth() + 1) thisMonth += count;
    }
  }

  const { currentStreak, longestStreak } = computeStreaks(dayCounts, today);

  return {
    today: dayCounts.get(todayKey) ?? 0,
    thisWeek,
    thisMonth,
    thisYear,
    total,
    currentStreak,
    longestStreak,
  };
}
