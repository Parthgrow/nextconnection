#!/usr/bin/env node
// Bulk-import contacts into one list from a JSON file.
//
// The file is an array of contact fields (company is required):
//   [{ "company": "Acme", "role": "…", "status": "Wishlist", "notes": "…" }, …]
//
// Entries whose company already exists for the user (in any list, compared
// case-insensitively) are skipped, so re-running an import is safe.
// Dry run by default; pass --apply to write.
//
//   npx tsx --env-file=.env scripts/import-contacts.ts --email you@example.com \
//     --list noida-agencies --file contacts.json            # dry run
//   … --apply                                               # write
import { readFile } from "node:fs/promises";
import { LIST_DEFINITIONS, LIST_IDS, isListId } from "@/lib/contact";
import { db } from "@/lib/db/client";
import { createContact, listContacts, pickPatch } from "@/lib/db/contacts";
import { userByEmailKey } from "@/lib/kv-keys";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

function option(name: string): string | undefined {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const normalize = (company: string) => company.trim().toLowerCase();

async function main() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    fail("Missing KV_REST_API_URL/KV_REST_API_TOKEN. Run with: npx tsx --env-file=.env scripts/import-contacts.ts");
  }
  const email = option("--email");
  const listId = option("--list");
  const file = option("--file");
  if (!email || !listId || !file) {
    fail("Usage: --email <account email> --list <list id> --file <contacts.json> [--apply]");
  }
  if (!isListId(listId)) fail(`Unknown list "${listId}". Lists: ${LIST_IDS.join(", ")}`);

  const userId = await db().get<string>(userByEmailKey(email));
  if (!userId) fail(`No account for ${email}`);

  const rows = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>[];
  if (!Array.isArray(rows)) fail(`${file} must contain a JSON array`);

  const existing = new Set((await listContacts(String(userId))).map((c) => normalize(c.company)));
  const toAdd: ReturnType<typeof pickPatch>[] = [];
  for (const row of rows) {
    const patch = pickPatch(row);
    if (!patch.company?.trim()) {
      console.log(`  skip (no company): ${JSON.stringify(row).slice(0, 80)}`);
    } else if (existing.has(normalize(patch.company))) {
      console.log(`  skip (already tracked): ${patch.company}`);
    } else {
      existing.add(normalize(patch.company));
      toAdd.push(patch);
    }
  }

  console.log(
    `${APPLY ? "APPLY" : "DRY RUN"}: ${toAdd.length} of ${rows.length} → "${LIST_DEFINITIONS[listId].name}"`
  );
  if (!APPLY) {
    for (const c of toAdd) console.log(`  + ${c.company}`);
    console.log("Nothing written. Re-run with --apply.");
    return;
  }

  // Spread createdAt by a millisecond each so the file order is kept.
  const start = Date.now();
  for (const [i, patch] of toAdd.entries()) {
    await createContact(String(userId), { ...patch, listId, createdAt: start + i });
  }
  console.log(`✓ added ${toAdd.length}`);
}

main().catch((err) => fail(String(err?.stack ?? err)));
