"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { register, AccountExistsError } from "@/lib/auth/credentials-provider";
import { createSession, deleteSession } from "@/lib/session";

export type LoginState = { error?: string } | undefined;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const user = await signIn("credentials", { email, password });
  if (!user) {
    return { error: "Invalid email or password." };
  }

  await createSession(user);
  redirect("/");
}

export type SignupState = { error?: string } | undefined;

export async function signup(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  let user;
  try {
    user = await register({ email, password });
  } catch (err) {
    if (err instanceof AccountExistsError) {
      return { error: err.message };
    }
    throw err;
  }

  await createSession(user);
  redirect("/");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
