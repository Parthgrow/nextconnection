import "server-only";
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { kv } from "@vercel/kv";
import type { AuthUser, CredentialsProvider } from "@/lib/auth/types";
import { userByEmailKey, userKey, accountKey } from "@/lib/kv-keys";

const scryptAsync = promisify(scrypt);

type UserRecord = { id: string; email: string; name?: string; createdAt: number };
type CredentialsAccount = { passwordHash: string };

export class AccountExistsError extends Error {}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPasswordHash(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, keyHex] = storedHash.split(":");
  if (!saltHex || !keyHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expectedKey = Buffer.from(keyHex, "hex");
  const derivedKey = (await scryptAsync(password, salt, expectedKey.length)) as Buffer;

  return derivedKey.length === expectedKey.length && timingSafeEqual(derivedKey, expectedKey);
}

// Only meaningful for credentials-style auth — an OAuth provider's "account"
// already exists on the provider's side, so this isn't part of the shared
// AuthProvider/CredentialsProvider interface.
export async function register({ email, password }: { email: string; password: string }): Promise<AuthUser> {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await kv.get<string>(userByEmailKey(normalizedEmail));
  if (existing) {
    throw new AccountExistsError("An account with this email already exists.");
  }

  const userId = randomUUID();
  const passwordHash = await hashPassword(password);

  await Promise.all([
    kv.set(userByEmailKey(normalizedEmail), userId),
    kv.hset(userKey(userId), { id: userId, email: normalizedEmail, createdAt: Date.now() }),
    kv.hset(accountKey("credentials", userId), { passwordHash }),
  ]);

  return { id: userId, email: normalizedEmail };
}

export const credentialsProvider: CredentialsProvider = {
  id: "credentials",

  async verify({ email, password }) {
    const userId = await kv.get<string>(userByEmailKey(email));
    if (!userId) return null;

    const account = await kv.hgetall<CredentialsAccount>(accountKey("credentials", userId));
    if (!account?.passwordHash) return null;

    const ok = await verifyPasswordHash(password, account.passwordHash);
    if (!ok) return null;

    const user = await kv.hgetall<UserRecord>(userKey(userId));
    if (!user) return null;

    return { id: user.id, email: user.email, name: user.name };
  },
};
