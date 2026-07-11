#!/usr/bin/env node
// Copies data from the old anonymous-cookie userId (the nc_uid value your
// browser had before login existed) to the real account created by
// create-admin.mjs, so your existing contacts/deadline show up after login.
//
// Dry-run by default (prints what it would do). Pass --apply to actually write.
// Does NOT delete the old keys — safe to re-run, and you can clean them up
// manually afterwards once you've confirmed the app looks right.
//
// Usage: node --env-file=.env scripts/migrate-user.mjs <oldUserId> <email> [--apply]

import { kv } from "@vercel/kv";

function userByEmailKey(email) {
  return `nextconnection:user:by-email:${email.trim().toLowerCase()}`;
}
function userKey(userId) {
  return `nextconnection:user:${userId}`;
}
function contactKey(userId, contactId) {
  return `nextconnection:user:${userId}:contact:${contactId}`;
}
function contactIndexKey(userId) {
  return `nextconnection:user:${userId}:contact_ids`;
}

async function main() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.error(
      "Missing KV_REST_API_URL/KV_REST_API_TOKEN.\nRun with: node --env-file=.env scripts/migrate-user.mjs <oldUserId> <email>"
    );
    process.exit(1);
  }

  const args = process.argv.slice(2).filter((a) => a !== "--apply");
  const apply = process.argv.includes("--apply");
  const [oldUserId, email] = args;

  if (!oldUserId || !email) {
    console.error("Usage: node --env-file=.env scripts/migrate-user.mjs <oldUserId> <email> [--apply]");
    process.exit(1);
  }

  const newUserId = await kv.get(userByEmailKey(email));
  if (!newUserId) {
    console.error(`No account found for ${email}. Run scripts/create-admin.mjs first.`);
    process.exit(1);
  }
  if (newUserId === oldUserId) {
    console.log("Old and new userId are already the same — nothing to migrate.");
    return;
  }

  const [oldUser, ids] = await Promise.all([
    kv.hgetall(userKey(oldUserId)),
    kv.zrange(contactIndexKey(oldUserId), 0, -1),
  ]);

  const contacts = ids.length
    ? await Promise.all(ids.map((id) => kv.get(contactKey(oldUserId, id))))
    : [];

  console.log(`Found ${contacts.filter(Boolean).length} contact(s) and ${oldUser?.dream100Deadline ? "a" : "no"} deadline under old userId ${oldUserId}.`);
  console.log(`Migrating to new userId ${newUserId} (${email}).`);

  if (!apply) {
    console.log("\nDry run only — nothing written. Re-run with --apply to perform the migration.");
    return;
  }

  const writes = contacts
    .filter((c) => c !== null)
    .flatMap((contact) => [
      kv.set(contactKey(newUserId, contact.id), contact),
      kv.zadd(contactIndexKey(newUserId), { score: contact.createdAt, member: contact.id }),
    ]);

  if (oldUser?.dream100Deadline) {
    writes.push(kv.hset(userKey(newUserId), { dream100Deadline: oldUser.dream100Deadline }));
  }

  await Promise.all(writes);
  console.log("Migration complete. Old keys were left untouched.");
}

main();
