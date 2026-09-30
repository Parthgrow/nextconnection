"use client";

import { useActionState, useState } from "react";
import { createToken } from "@/app/actions/mcp-tokens";

export default function CreateTokenForm({ mcpUrl, disabled }: { mcpUrl: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(createToken, undefined);
  const [copied, setCopied] = useState<string | null>(null);

  const command = state?.token
    ? `claude mcp add --transport http nextconnection ${mcpUrl} --header "Authorization: Bearer ${state.token}"`
    : "";
  const connectorUrl = state?.token ? `${mcpUrl}/${state.token}` : "";

  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
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
          onClick={() => setCopied(null)}
          className="whitespace-nowrap rounded-full bg-black dark:bg-white text-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Generating..." : "Generate MCP token"}
        </button>
      </form>

      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      {state?.token && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Token <span className="font-medium">{state.name}</span>
            {" created. Copy what you need now — it won't be shown again."}
          </p>

          <CopyBlock
            title="Claude Code (terminal)"
            hint="Run this in a terminal."
            text={command}
            copied={copied === "command"}
            onCopy={() => copy("command", command)}
          />

          <CopyBlock
            title="claude.ai connector URL (web, desktop and mobile apps)"
            hint="In claude.ai, open Settings → Connectors → Add custom connector and paste this as the MCP server URL. The URL itself is the password: don't share it, and revoke this token if it leaks."
            text={connectorUrl}
            copied={copied === "url"}
            onCopy={() => copy("url", connectorUrl)}
          />
        </div>
      )}
    </div>
  );
}

function CopyBlock({
  title,
  hint,
  text,
  copied,
  onCopy,
}: {
  title: string;
  hint: string;
  text: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-black dark:text-zinc-50">{title}</h3>
      <p className="text-xs text-zinc-500">{hint}</p>
      <pre className="whitespace-pre-wrap break-all rounded-lg bg-zinc-100 dark:bg-zinc-800 p-3 text-xs">
        {text}
      </pre>
      <button
        type="button"
        onClick={onCopy}
        className="self-start rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1 text-sm"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
