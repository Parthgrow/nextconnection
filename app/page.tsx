import ApplicationsTable from "./ApplicationsTable";
import CommandBar from "./CommandBar";
import { logout } from "@/app/actions/auth";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center bg-[var(--paper)] min-h-screen">
      <main className="flex flex-1 w-full max-w-5xl flex-col gap-6 py-10 px-6 pb-28">
        <div className="flex items-baseline justify-between gap-4 border-b border-[var(--rule-ink)] pb-2">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
            Applications
          </h1>
          <form action={logout}>
            <button
              type="submit"
              className="text-[13px] text-[var(--ink-4)] bg-transparent border-none cursor-pointer transition-colors duration-150 hover:text-[var(--ink-2)]"
            >
              Sign out
            </button>
          </form>
        </div>
        <ApplicationsTable />
      </main>
      <CommandBar />
    </div>
  );
}
