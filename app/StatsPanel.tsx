import type { ApplicationStats } from "@/lib/stats";

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[22px] leading-none text-[var(--ink)]">{value}</span>
      <span className="smallcaps">{label}</span>
    </div>
  );
}

export default function StatsPanel({ stats }: { stats: ApplicationStats }) {
  return (
    // A tally line, not a dashboard. No cards, no rules between figures —
    // spacing separates them, the way a printed summary row does.
    <div className="flex flex-wrap items-end gap-x-9 gap-y-4 pb-4 border-b border-[var(--rule)]">
      <div className="flex flex-col gap-0.5">
        <span className="text-[38px] leading-none text-[var(--ink)]">{stats.today}</span>
        <span className="smallcaps">Applied today</span>
      </div>

      <Stat value={stats.currentStreak} label="Day streak" />
      {stats.longestStreak > stats.currentStreak && (
        <Stat value={stats.longestStreak} label="Best streak" />
      )}
      <Stat value={stats.total} label="Total" />
      <Stat value={stats.thisWeek} label="This week" />
      <Stat value={stats.thisMonth} label="This month" />
      <Stat value={stats.thisYear} label="This year" />
    </div>
  );
}
