import { createClient, type VercelKV } from "@vercel/kv";

let client: VercelKV | undefined;

// KV client for the contact/list data layer. Values come back as raw strings:
// the default client JSON-parses every value it reads, which silently turns a
// text field like a phone number ("7983551280") into a number.
export function db(): VercelKV {
  client ??= createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
    automaticDeserialization: false,
  });
  return client;
}

// With automaticDeserialization off, HGETALL comes back as Redis's flat
// [field, value, field, value, …] reply rather than an object. Returns null
// for a missing (empty) hash.
export async function hgetallStrings(key: string): Promise<Record<string, string> | null> {
  const reply = (await db().hgetall(key)) as unknown;
  if (!reply) return null;
  let entries: [string, string][];
  if (Array.isArray(reply)) {
    entries = [];
    for (let i = 0; i + 1 < reply.length; i += 2) entries.push([String(reply[i]), String(reply[i + 1])]);
  } else {
    entries = Object.entries(reply as Record<string, unknown>).map(([k, v]) => [k, String(v)]);
  }
  return entries.length ? Object.fromEntries(entries) : null;
}
