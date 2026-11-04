"use client";

import { useEffect, useState } from "react";

// A "Send" button that doesn't send anything: it just plays a short
// home + career animation — a house and a briefcase slide in from either
// side, meet in the middle, and settle under a "Home + Career" caption.
const ANIMATION_MS = 2600;

function HouseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9v11h14V9" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}

export default function SendButton() {
  // Bumped on every click so a second click restarts the animation.
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!run) return;
    const timer = setTimeout(() => setRun(0), ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [run]);

  return (
    <>
      <button
        type="button"
        onClick={() => setRun((n) => n + 1)}
        className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition-transform hover:scale-105 active:scale-95 dark:bg-white dark:text-black"
      >
        Send
      </button>

      {run > 0 && (
        <div
          key={run}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
        >
          <div className="hc-backdrop absolute inset-0 bg-white/60 backdrop-blur-sm dark:bg-black/60" />
          <div className="relative flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="hc-left text-amber-500">
                <HouseIcon />
              </span>
              <span className="hc-plus text-3xl font-semibold text-zinc-400">+</span>
              <span className="hc-right text-indigo-500">
                <BriefcaseIcon />
              </span>
            </div>
            <span className="hc-glow absolute top-6 h-24 w-24 rounded-full bg-gradient-to-r from-amber-400/40 to-indigo-500/40 blur-2xl" />
            <p className="hc-caption text-lg font-semibold text-black dark:text-white">
              Home + Career
            </p>
          </div>
        </div>
      )}
    </>
  );
}
