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
      className="fixed bottom-6 left-1/2 -translate-x-1/2 flex w-[calc(100%-2rem)] max-w-2xl gap-2 border border-[var(--rule)] bg-[var(--paper)] px-2 py-2 shadow-[0_18px_40px_-26px_rgba(33,31,28,0.55)]"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Add this person's information to the list...`}
        className="flex-1 px-3 py-2 text-[15px] outline-none bg-transparent text-[var(--ink)] placeholder:text-[var(--ink-4)]"
      />
      <button
        type="submit"
        className="px-4 py-2 text-[14px] font-semibold border-none bg-[var(--ink)] text-[var(--paper)] cursor-pointer transition-opacity duration-150 hover:opacity-85"
      >
        Send
      </button>
    </form>
  );
}
