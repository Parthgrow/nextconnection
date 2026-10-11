#!/usr/bin/env node
// Lists migration (one list per contact).
//
// For every user it:
//   1. converts contacts from the old JSON-string format to hashes,
//   2. gives each contact a listId: Dream 100 if it was starred, otherwise
//      Applications, unless the plan file assigns it elsewhere,
//   3. tidies misplaced fields (URLs/emails in Company, URLs in Contact email,
//      emails in Contact name) — nothing is dropped, displaced text goes to notes,
//   4. applies the approved merges and deletes from the plan file,
//   5. copies the Dream 100 deadline from the user record onto the Dream 100 list.
//
// Dry run by default: prints every change and writes nothing. With --apply it
// first writes a full backup of all nextconnection:* keys to --backup-dir.
// Safe to re-run: merged/deleted ids are skipped and cleanups no longer match.
//
//   npx tsx --env-file=.env scripts/migrate-lists.ts --plan plan.json            # dry run
//   npx tsx --env-file=.env scripts/migrate-lists.ts --plan plan.json --apply    # write
//
// Plan file (see scripts/migrate-lists.example.json):
//   { "merges":  [{ "keep": id, "merge": [id, …], "set": { field: value } }],
//     "deletes": [id, …],
//     "lists":   { "leads": [id, …], "dream100": [id, …], "applications": [id, …] } }
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CONTACT_TEXT_FIELDS,
  LIST_DEFINITIONS,
  LIST_IDS,
  isListId,
  type Contact,
  type ListId,
} from "@/lib/contact";
import { db, hgetallStrings } from "@/lib/db/client";
import { readStored, toHash } from "@/lib/db/contacts";
import { contactIndexKey, contactKey, listKey, userKey } from "@/lib/kv-keys";

type TextField = (typeof CONTACT_TEXT_FIELDS)[number];
type Plan = {
  merges?: { keep: string; merge: string[]; set?: Partial<Record<TextField, string>> }[];
  deletes?: string[];
  lists?: Partial<Record<ListId, string[]>>;
};

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const APPLY = flag("--apply");

// ---------- cleanup rules ----------

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const URL_RE = /https?:\/\/\S+/i;
const FREE_MAIL = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "proton.me"]);
const STATUS_RANK: Record<string, number> = { Wishlist: 0, Applied: 1, Rejected: 2, Interviewing: 3, Offer: 4 };

function appendNote(c: Contact, line: string) {
  c.notes = c.notes ? `${c.notes}\n${line}` : line;
}

function nameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const parts = u.pathname.split("/").filter(Boolean);
    if (host.endsWith("linkedin.com") && (parts[0] === "company" || parts[0] === "in") && parts[1]) return parts[1];
    if (host.endsWith("youtube.com") && parts[0]?.startsWith("@")) return parts[0];
    return host;
  } catch {
    return url;
  }
}

// Put a URL in link if it's free; otherwise keep it in notes.
function placeLink(c: Contact, url: string, log: string[]) {
  if (!c.link) {
    c.link = url;
    log.push(`link ← ${url}`);
  } else if (c.link !== url) {
    appendNote(c, `[migrated] Link: ${url}`);
    log.push(`notes ← link ${url}`);
  }
}

function placeEmail(c: Contact, email: string, log: string[]) {
  if (!c.contactEmail) {
    c.contactEmail = email;
    log.push(`contactEmail ← ${email}`);
  } else if (c.contactEmail !== email) {
    appendNote(c, `[migrated] Email: ${email}`);
    log.push(`notes ← email ${email}`);
  }
}

function cleanup(c: Contact): string[] {
  const log: string[] = [];
  for (const f of CONTACT_TEXT_FIELDS) c[f] = c[f].trim();

  // Contact email that isn't an email: URLs → link, other text → notes. Runs
  // first so the field is free for an email found in Company below.
  if (c.contactEmail && !EMAIL_RE.test(c.contactEmail)) {
    const original = c.contactEmail;
    const url = original.match(URL_RE)?.[0];
    if (url && original === url) placeLink(c, url, log);
    else {
      appendNote(c, `[migrated] ${original}`);
      log.push(`notes ← "${original}" (was in contactEmail)`);
    }
    c.contactEmail = "";
  }

  // Company holding a URL → link; name from the URL.
  const companyUrl = c.company.match(URL_RE)?.[0];
  if (companyUrl) {
    const original = c.company;
    const rest = c.company.replace(companyUrl, "").trim();
    placeLink(c, companyUrl, log);
    c.company = rest || nameFromUrl(companyUrl);
    log.push(`company "${original}" → "${c.company}"`);
  }

  // Company holding an email → contactEmail; name from the domain.
  const companyEmail = c.company.match(EMAIL_RE)?.[0];
  if (companyEmail) {
    const original = c.company;
    const [local, domain] = companyEmail.toLowerCase().split("@");
    const rest = c.company.replace(companyEmail, "").replace(/[()]/g, "").trim();
    placeEmail(c, companyEmail, log);
    c.company = FREE_MAIL.has(domain) ? local : domain;
    if (rest) {
      appendNote(c, `[migrated] ${rest}`);
      log.push(`notes ← "${rest}" (was in company)`);
    }
    log.push(`company "${original}" → "${c.company}"`);
  }

  // Contact name that is just an email → contactEmail.
  const nameEmail = c.contactName.match(EMAIL_RE)?.[0];
  if (nameEmail && c.contactName === nameEmail) {
    placeEmail(c, nameEmail, log);
    c.contactName = "";
  }
  return log;
}

// Fold `source` into `target`: fill empty fields, keep the most advanced status
// and earliest applied date, and never drop text — conflicts go to notes.
function mergeInto(target: Contact, source: Contact): string[] {
  const log = [`merged ${source.id.slice(0, 8)} "${source.company}"`];
  for (const f of CONTACT_TEXT_FIELDS) {
    const a = target[f];
    const b = source[f];
    if (!b || a === b) continue;
    if (f === "status") {
      if ((STATUS_RANK[b] ?? 0) > (STATUS_RANK[a] ?? 0)) target.status = b;
    } else if (f === "appliedDate") {
      if (!a || b < a) target.appliedDate = b;
    } else if (f === "notes") {
      appendNote(target, `[merged from "${source.company}"] ${b}`);
    } else if (!a) {
      target[f] = b;
    } else {
      appendNote(target, `[merged from "${source.company}"] ${f}: ${b}`);
    }
  }
  if (source.listId === "dream100") target.listId = "dream100";
  target.createdAt = Math.min(target.createdAt, source.createdAt);
  return log;
}

function applySet(c: Contact, set: Partial<Record<TextField, string>>): string[] {
  const log: string[] = [];
  for (const [f, value] of Object.entries(set) as [TextField, string][]) {
    if (c[f] === value) continue;
    if (c[f]) appendNote(c, `[migrated] Previous ${f}: ${c[f]}`);
    log.push(`${f} "${c[f]}" → "${value}"`);
    c[f] = value;
  }
  return log;
}

// ---------- KV helpers ----------

async function scanKeys(match: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | number = 0;
  do {
    const [next, batch] = (await db().scan(cursor, { match, count: 500 })) as [string | number, string[]];
    keys.push(...batch);
    cursor = next;
  } while (String(cursor) !== "0");
  return keys;
}

async function backup(dir: string): Promise<string> {
  const dump: Record<string, { type: string; value: unknown }> = {};
  for (const key of await scanKeys("nextconnection:*")) {
    const type = String(await db().type(key));
    const value =
      type === "string" ? await db().get(key)
      : type === "hash" ? await hgetallStrings(key)
      : type === "zset" ? await db().zrange(key, 0, -1, { withScores: true })
      : type === "set" ? await db().smembers(key)
      : type === "list" ? await db().lrange(key, 0, -1)
      : null;
    dump[key] = { type, value };
  }
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `kv-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(file, JSON.stringify(dump, null, 2));
  return file;
}

// ---------- per-user migration ----------

async function migrateUser(userId: string, plan: Plan) {
  console.log(`\n=== user ${userId} ===`);
  const ids = await db().zrange<string[]>(contactIndexKey(userId), 0, -1);
  const stored = new Map<string, { contact: Contact; legacy: boolean }>();
  for (const id of ids) {
    const s = await readStored(userId, id);
    if (s) stored.set(id, s);
  }
  const contacts = new Map([...stored].map(([id, s]) => [id, structuredClone(s.contact)]));
  const changes = new Map<string, string[]>();
  const note = (id: string, lines: string[]) => {
    if (lines.length) changes.set(id, [...(changes.get(id) ?? []), ...lines]);
  };

  for (const [id, c] of contacts) note(id, cleanup(c));

  const removed = new Map<string, string>(); // id → reason
  for (const m of plan.merges ?? []) {
    const target = contacts.get(m.keep);
    if (!target) {
      if (m.merge.some((id) => contacts.has(id))) console.warn(`  ! merge target ${m.keep} not found; skipped`);
      continue;
    }
    for (const id of m.merge) {
      const source = contacts.get(id);
      if (!source) continue; // already merged on a previous run
      note(m.keep, mergeInto(target, source));
      contacts.delete(id);
      removed.set(id, `merged into ${m.keep.slice(0, 8)} "${target.company}"`);
    }
    if (m.set) note(m.keep, applySet(target, m.set));
  }

  for (const id of plan.deletes ?? []) {
    if (contacts.delete(id)) removed.set(id, "deleted");
  }

  for (const [listId, listIds] of Object.entries(plan.lists ?? {})) {
    if (!isListId(listId)) throw new Error(`Unknown list in plan: ${listId}`);
    for (const id of listIds) {
      const c = contacts.get(id);
      if (c && c.listId !== listId) {
        note(id, [`list ${c.listId} → ${listId}`]);
        c.listId = listId;
      }
    }
  }

  // Report.
  for (const [id, lines] of changes) {
    if (!contacts.has(id)) continue;
    console.log(`  ~ ${id.slice(0, 8)} "${contacts.get(id)!.company}"`);
    for (const line of lines) console.log(`      ${line}`);
  }
  for (const [id, reason] of removed) {
    console.log(`  - ${id.slice(0, 8)} "${stored.get(id)!.contact.company}" (${reason})`);
  }
  const legacyCount = [...stored.values()].filter((s) => s.legacy).length;
  const counts = Object.fromEntries(
    LIST_IDS.map((l) => [LIST_DEFINITIONS[l].name, [...contacts.values()].filter((c) => c.listId === l).length])
  );
  console.log(
    `  ${stored.size} contacts (${legacyCount} in old JSON format) → ${contacts.size} after ${removed.size} merged/deleted`
  );
  console.log(`  per list: ${JSON.stringify(counts)}`);
  for (const l of LIST_IDS) {
    const target = LIST_DEFINITIONS[l].targetCount;
    if (target && counts[LIST_DEFINITIONS[l].name] > target) {
      console.warn(`  ! ${LIST_DEFINITIONS[l].name} has more than ${target} contacts`);
    }
  }

  const legacyDeadline = await db().hget<string>(userKey(userId), "dream100Deadline");
  const listDeadline = await db().hget<string>(listKey(userId, "dream100"), "deadline");
  const moveDeadline = legacyDeadline != null && listDeadline == null;
  if (moveDeadline) console.log(`  Dream 100 deadline "${legacyDeadline}" → list`);

  if (!APPLY) return;

  for (const [id, c] of contacts) {
    const before = stored.get(id)!;
    if (!before.legacy && !changes.has(id)) continue;
    const tx = db().multi();
    tx.del(contactKey(userId, id));
    tx.hset(contactKey(userId, id), toHash(c));
    tx.zadd(contactIndexKey(userId), { score: c.createdAt, member: id });
    await tx.exec();
  }
  for (const id of removed.keys()) {
    const tx = db().multi();
    tx.del(contactKey(userId, id));
    tx.zrem(contactIndexKey(userId), id);
    await tx.exec();
  }
  if (moveDeadline) await db().hset(listKey(userId, "dream100"), { deadline: legacyDeadline });
  console.log("  ✓ written");
}

async function main() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.error("Missing KV_REST_API_URL/KV_REST_API_TOKEN. Run with: npx tsx --env-file=.env scripts/migrate-lists.ts");
    process.exit(1);
  }
  const planPath = option("--plan");
  const plan: Plan = planPath ? JSON.parse(await readFile(planPath, "utf8")) : {};

  const userIds = option("--user")
    ? [option("--user")!]
    : await Promise.all(
        (await scanKeys("nextconnection:user:by-email:*")).map(async (k) => String(await db().get(k)))
      );

  console.log(APPLY ? "APPLY mode — changes will be written." : "DRY RUN — nothing will be written. Re-run with --apply.");
  if (APPLY) console.log(`Backup: ${await backup(option("--backup-dir") ?? "backups")}`);

  for (const userId of userIds) await migrateUser(userId, plan);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
