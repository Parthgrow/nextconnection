import Link from "next/link";
import ApplicationsTable from "./ApplicationsTable";
import CommandBar from "./CommandBar";
import SendButton from "./SendButton";
import { logout } from "@/app/actions/auth";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black min-h-screen">
      <main className="flex flex-1 w-full max-w-5xl flex-col gap-6 py-12 px-6 pb-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Applications
          </h1>
          <div className="flex items-center gap-4">
            <SendButton />
            <Link
              href="/settings"
              className="whitespace-nowrap text-sm text-zinc-500 hover:text-black dark:hover:text-white"
            >
              Connect Claude
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="whitespace-nowrap text-sm text-zinc-500 hover:text-black dark:hover:text-white"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <ApplicationsTable />
      </main>
      <CommandBar />
    </div>
  );
}
