"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/app/actions/auth";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <div className="flex flex-1 items-center justify-center min-h-screen bg-[var(--paper)] px-6">
      <form
        action={action}
        className="w-full max-w-sm flex flex-col gap-4 border border-[var(--rule)] p-8"
      >
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-[var(--ink)] border-b border-[var(--rule-ink)] pb-2 mb-1">Create an account</h1>

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="smallcaps">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            className="border border-[var(--rule)] bg-transparent px-3 py-2 text-[15px] text-[var(--ink)] outline-none transition-colors duration-150 focus:border-[var(--ink-3)]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="smallcaps">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="border border-[var(--rule)] bg-transparent px-3 py-2 text-[15px] text-[var(--ink)] outline-none transition-colors duration-150 focus:border-[var(--ink-3)]"
          />
        </div>

        {state?.error && <p className="text-[14px] text-[var(--ink-2)] border border-[var(--rule)] bg-[var(--paper-2)] px-3 py-2">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 border-none bg-[var(--ink)] text-[var(--paper)] px-4 py-2.5 text-[15px] font-semibold cursor-pointer transition-opacity duration-150 hover:opacity-85 disabled:opacity-40"
        >
          {pending ? "Creating account…" : "Sign up"}
        </button>

        <p className="text-[14px] text-[var(--ink-3)] text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--ink)] underline underline-offset-4 decoration-[var(--rule)] hover:decoration-[var(--ink)] transition-colors duration-150">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
