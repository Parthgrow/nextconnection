import { randomUUID } from "node:crypto";
import { db, hgetallStrings } from "@/lib/db/client";
import { contactIndexKey, contactKey } from "@/lib/kv-keys";
import {
  CONTACT_TEXT_FIELDS,
  DEFAULT_LIST_ID,
  LIST_DEFINITIONS,
  STATUS_OPTIONS,
  isListId,
  type Contact,
  type ContactPatch,
  type ListId,
} from "@/lib/contact";

// Each contact is a Redis hash (one field per column), so an update writes only
// the fields that changed: two edits to different fields can't overwrite each
// other. Contacts written before the lists migration are a single JSON string;
// they are still readable here and are converted to a hash on their next write.
//
//   nextconnection:user:<userId>:contact:<id>   hash   id, listId, company, …, createdAt
//   nextconnection:user:<userId>:contact_ids    zset   contact ids scored by createdAt

type RawHash = Record<string, string>;
export type Stored = { contact: Contact; legacy: boolean };

export class ListFullError extends Error {}

export function toHash(fields: Record<string, unknown>): RawHash {
  const out: RawHash = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) out[key] = String(value);
  }
  return out;
}

function withDefaults(id: string, fields: Record<string, unknown>, listId: ListId): Contact {
  const contact = { id, listId, createdAt: Number(fields.createdAt) || 0 } as Contact;
  for (const field of CONTACT_TEXT_FIELDS) {
    contact[field] = fields[field] == null ? "" : String(fields[field]);
  }
  if (!contact.status) contact.status = STATUS_OPTIONS[0];
  return contact;
}

function fromHash(id: string, hash: RawHash): Contact {
  return withDefaults(id, hash, isListId(hash.listId) ? hash.listId : DEFAULT_LIST_ID);
}

// Pre-migration shape: { …fields, isDream100: boolean }.
export function fromLegacyJson(id: string, raw: string): Contact {
  const old = JSON.parse(raw) as Record<string, unknown>;
  return withDefaults(id, old, old.isDream100 ? "dream100" : DEFAULT_LIST_ID);
}

function isWrongType(err: unknown): boolean {
  return err instanceof Error && err.message.includes("WRONGTYPE");
}

export async function readStored(userId: string, id: string): Promise<Stored | null> {
  const key = contactKey(userId, id);
  try {
    const hash = await hgetallStrings(key);
    return hash ? { contact: fromHash(id, hash), legacy: false } : null;
  } catch (err) {
    if (!isWrongType(err)) throw err;
    const raw = await db().get<string>(key);
    return raw ? { contact: fromLegacyJson(id, raw), legacy: true } : null;
  }
}

// Keep only fields a caller may change, as strings; drop an invalid listId.
export function pickPatch(input: Record<string, unknown>): ContactPatch {
  const patch: ContactPatch = {};
  for (const field of CONTACT_TEXT_FIELDS) {
    if (input[field] !== undefined && input[field] !== null) patch[field] = String(input[field]);
  }
  if (isListId(input.listId)) patch.listId = input.listId;
  return patch;
}

export async function getContact(userId: string, id: string): Promise<Contact | null> {
  return (await readStored(userId, id))?.contact ?? null;
}

export async function listContacts(userId: string): Promise<Contact[]> {
  const ids = await db().zrange<string[]>(contactIndexKey(userId), 0, -1);
  const stored = await Promise.all(ids.map((id) => readStored(userId, id)));
  return stored.filter((s): s is Stored => s !== null).map((s) => s.contact);
}

async function assertListHasRoom(userId: string, listId: ListId): Promise<void> {
  const { name, targetCount } = LIST_DEFINITIONS[listId];
  if (!targetCount) return;
  const count = (await listContacts(userId)).filter((c) => c.listId === listId).length;
  if (count >= targetCount) throw new ListFullError(`${name} is full (${targetCount} max).`);
}

export async function createContact(
  userId: string,
  input: ContactPatch & { id?: string; createdAt?: number }
): Promise<Contact> {
  const id = input.id ?? randomUUID();
  const contact = withDefaults(
    id,
    { ...input, createdAt: input.createdAt ?? Date.now() },
    input.listId ?? DEFAULT_LIST_ID
  );
  await assertListHasRoom(userId, contact.listId);

  const tx = db().multi();
  tx.hset(contactKey(userId, id), toHash(contact));
  tx.zadd(contactIndexKey(userId), { score: contact.createdAt, member: id });
  await tx.exec();
  return contact;
}

// Partial update: only the fields in `patch` are written. Returns null if the
// contact doesn't exist.
export async function updateContact(
  userId: string,
  id: string,
  patch: ContactPatch
): Promise<Contact | null> {
  const stored = await readStored(userId, id);
  if (!stored) return null;
  if (patch.listId && patch.listId !== stored.contact.listId) {
    await assertListHasRoom(userId, patch.listId);
  }

  const updated: Contact = { ...stored.contact, ...patch, id, createdAt: stored.contact.createdAt };
  const key = contactKey(userId, id);
  if (stored.legacy) {
    // Convert the JSON string to a hash in one transaction.
    const tx = db().multi();
    tx.del(key);
    tx.hset(key, toHash(updated));
    await tx.exec();
  } else if (Object.keys(patch).length) {
    await db().hset(key, toHash(patch));
  }
  return updated;
}

export async function deleteContact(userId: string, id: string): Promise<Contact | null> {
  const stored = await readStored(userId, id);
  if (!stored) return null;
  const tx = db().multi();
  tx.del(contactKey(userId, id));
  tx.zrem(contactIndexKey(userId), id);
  await tx.exec();
  return stored.contact;
}
