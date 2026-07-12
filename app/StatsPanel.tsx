import type { ApplicationStats } from "@/lib/stats";

function Divider() {
  return <div className="hidden sm:block h-10 w-px bg-zinc-200 dark:bg-zinc-800" />;
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xl font-semibold text-black dark:text-zinc-50">{value}</span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
    </div>
  );
}

export default function StatsPanel({ stats }: { stats: ApplicationStats }) {
  return (
    <div className="flex flex-wrap items-center gap-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-5xl font-semibold leading-none text-black dark:text-zinc-50">
          {stats.today}
        </span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">Applied today</span>
      </div>

      <Divider />

      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          🔥
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-lg font-semibold text-black dark:text-zinc-50">
            {stats.currentStreak}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            day streak
            {stats.longestStreak > stats.currentStreak ? ` · best ${stats.longestStreak}` : ""}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          🌳
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-lg font-semibold text-black dark:text-zinc-50">
            {stats.total}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">total applications</span>
        </div>
      </div>

      <Divider />

      <div className="flex gap-6">
        <StatTile label="This week" value={stats.thisWeek} />
        <StatTile label="This month" value={stats.thisMonth} />
        <StatTile label="This year" value={stats.thisYear} />
      </div>
    </div>
  );
}
