import Link from "next/link";
import { headers } from "next/headers";
import { verifySession } from "@/lib/dal";
import { listMcpTokens, MAX_TOKENS_PER_USER } from "@/lib/mcp/auth";
import { revokeToken } from "@/app/actions/mcp-tokens";
import CreateTokenForm from "./CreateTokenForm";

export default async function SettingsPage() {
  const { userId, email } = await verifySession();
  const [tokens, headersList] = await Promise.all([listMcpTokens(userId), headers()]);

  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
  const proto =
    headersList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const mcpUrl = `${proto}://${host}/api/mcp`;

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black min-h-screen">
      <main className="flex flex-1 w-full max-w-3xl flex-col gap-6 py-12 px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Connect Claude</h1>
          <Link href="/" className="text-sm text-zinc-500 hover:text-black dark:hover:text-white">
            ← Applications
          </Link>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Generate a token to let Claude (Claude Code or the claude.ai apps) read and manage the
          contacts for{" "}
          <span className="font-medium text-black dark:text-zinc-50">{email}</span> through the
          MCP server at <code className="rounded bg-zinc-100 dark:bg-zinc-800 px-1">{mcpUrl}</code>.
          Anyone with a token has full access to your contacts, so treat it like a password.
        </p>

        <CreateTokenForm mcpUrl={mcpUrl} disabled={tokens.length >= MAX_TOKENS_PER_USER} />

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">
            Active tokens ({tokens.length}/{MAX_TOKENS_PER_USER})
          </h2>
          {tokens.length === 0 ? (
            <p className="text-sm text-zinc-500">No tokens yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              {tokens.map((token) => (
                <li key={token.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-black dark:text-zinc-50">
                      {token.name}
                    </span>
                    <span className="text-xs text-zinc-500">
                      <code>{token.hint}…</code> · created{" "}
                      {new Date(token.createdAt).toISOString().slice(0, 10)}
                    </span>
                  </div>
                  <form action={revokeToken}>
                    <input type="hidden" name="id" value={token.id} />
                    <button
                      type="submit"
                      className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Revoke
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
