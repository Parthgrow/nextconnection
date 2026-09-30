"use client";

import { useActionState, useState } from "react";
import { createToken } from "@/app/actions/mcp-tokens";

export default function CreateTokenForm({ mcpUrl, disabled }: { mcpUrl: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(createToken, undefined);
  const [copied, setCopied] = useState(false);

  const command = state?.token
    ? `claude mcp add --transport http nextconnection ${mcpUrl} --header "Authorization: Bearer ${state.token}"`
    : "";

  async function copy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6">
      <form action={action} className="flex flex-col sm:flex-row gap-2">
        <input
          name="name"
          type="text"
          maxLength={50}
          placeholder="Token name, e.g. Work laptop"
          className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-black dark:focus:border-white"
        />
        <button
          type="submit"
          disabled={pending || disabled}
          onClick={() => setCopied(false)}
          className="whitespace-nowrap rounded-full bg-black dark:bg-white text-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Generating..." : "Generate MCP token"}
        </button>
      </form>

      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      {state?.token && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Token <span className="font-medium">{state.name}</span>
            {" created. Copy it now — it won't be shown again. Run this in a terminal to connect Claude Code:"}
          </p>
          <pre className="whitespace-pre-wrap break-all rounded-lg bg-zinc-100 dark:bg-zinc-800 p-3 text-xs">
            {command}
          </pre>
          <button
            type="button"
            onClick={copy}
            className="self-start rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1 text-sm"
          >
            {copied ? "Copied" : "Copy command"}
          </button>
        </div>
      )}
    </div>
  );
}
