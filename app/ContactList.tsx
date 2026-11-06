import { LIST_DEFINITIONS, type Contact } from "@/lib/contact";
import { toDateKey } from "@/lib/stats";
import { statusStyle } from "./statusStyles";

function shortDate(dateKey: string): string {
  return new Date(dateKey + "T00:00:00").toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

// Notion-style list: one compact line per contact — company and a status pill,
// plus the next-action date when there is one. Tapping a row opens it.
export default function ContactList({
  rows,
  showList,
  onOpen,
}: {
  rows: Contact[];
  showList: boolean;
  onOpen: (id: string) => void;
}) {
  const today = toDateKey(new Date());

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Nothing here yet.</p>;
  }

  return (
    <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
      {rows.map((row) => {
        const overdue = row.nextActionDate !== "" && row.nextActionDate < today;
        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onOpen(row.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              <span
                className={`w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-medium ring-1 ring-inset ${statusStyle(row.status)}`}
              >
                {row.status}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-black dark:text-zinc-50">
                {row.company.trim() || <span className="text-zinc-400">Untitled</span>}
              </span>
              {showList && (
                <span className="hidden shrink-0 text-xs text-zinc-400 sm:inline">
                  {LIST_DEFINITIONS[row.listId].name}
                </span>
              )}
              {row.nextActionDate && (
                <span
                  className={`shrink-0 text-xs tabular-nums ${
                    overdue ? "font-medium text-red-500" : "text-zinc-500 dark:text-zinc-400"
                  }`}
                  title={row.nextAction || undefined}
                >
                  {shortDate(row.nextActionDate)}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
