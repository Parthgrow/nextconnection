"use client";

import { useState } from "react";

export default function CommandBar() {
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    // Placeholder: this is where the natural-language command will be
    // parsed and applied to the table once the AI-native flow is wired up.
    console.log("Command submitted:", value);
    setValue("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 flex w-full max-w-2xl gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 py-2 shadow-lg shadow-black/10 dark:shadow-black/40"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Add this person's information to the list...`}
        className="flex-1 rounded-full px-3 py-2 text-sm outline-none bg-transparent"
      />
      <button
        type="submit"
        className="rounded-full bg-black dark:bg-white text-white dark:text-black px-4 py-2 text-sm font-medium"
      >
        Send
      </button>
    </form>
  );
}
