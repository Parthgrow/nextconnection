#!/usr/bin/env node
// Run with: node --env-file=.env scripts/create-admin.mjs
// Creates (or rotates the password for) the account that can sign in to this app.
import { createInterface } from "node:readline/promises";
import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { kv } from "@vercel/kv";

const scryptAsync = promisify(scrypt);

function userByEmailKey(email) {
  return `nextconnection:user:by-email:${email.trim().toLowerCase()}`;
}
function userKey(userId) {
  return `nextconnection:user:${userId}`;
}
function accountKey(providerId, userId) {
  return `nextconnection:account:${providerId}:${userId}`;
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

async function main() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.error(
      "Missing KV_REST_API_URL/KV_REST_API_TOKEN.\nRun with: node --env-file=.env scripts/create-admin.mjs"
    );
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answers = [];
  process.stdout.write("Email: ");
  for await (const line of rl) {
    answers.push(line);
    if (answers.length === 1) process.stdout.write("Password (min 8 chars): ");
    if (answers.length === 2) break;
  }
  rl.close();
  const [email, password] = [answers[0]?.trim().toLowerCase() ?? "", answers[1] ?? ""];

  if (!email || !password) {
    console.error("Email and password are required.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const existingUserId = await kv.get(userByEmailKey(email));
  const userId = existingUserId ?? randomUUID();
  const passwordHash = await hashPassword(password);

  const userFields = existingUserId
    ? { id: userId, email }
    : { id: userId, email, createdAt: Date.now() };

  await Promise.all([
    kv.set(userByEmailKey(email), userId),
    kv.hset(userKey(userId), userFields),
    kv.hset(accountKey("credentials", userId), { passwordHash }),
  ]);

  console.log(
    existingUserId
      ? `Password updated for ${email} (userId: ${userId})`
      : `Account created for ${email} (userId: ${userId})`
  );
}

main();
