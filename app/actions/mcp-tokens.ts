"use server";

import { refresh } from "next/cache";
import { verifySession } from "@/lib/dal";
import { createMcpToken, revokeMcpToken, TooManyTokensError } from "@/lib/mcp/auth";

export type CreateTokenState = { error?: string; token?: string; name?: string } | undefined;

export async function createToken(
  _prevState: CreateTokenState,
  formData: FormData
): Promise<CreateTokenState> {
  const { userId } = await verifySession();
  const name = String(formData.get("name") ?? "").trim().slice(0, 50) || "Claude";

  let token;
  try {
    token = await createMcpToken(userId, name);
  } catch (err) {
    if (err instanceof TooManyTokensError) return { error: err.message };
    throw err;
  }

  refresh();
  return { token, name };
}

export async function revokeToken(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  await revokeMcpToken(userId, String(formData.get("id") ?? ""));
  refresh();
}
