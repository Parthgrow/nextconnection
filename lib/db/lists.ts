import { db, hgetallStrings } from "@/lib/db/client";
import { listKey, userKey } from "@/lib/kv-keys";
import { LIST_DEFINITIONS, LIST_IDS, type List, type ListId } from "@/lib/contact";

// The lists themselves are fixed (lib/contact.ts); KV only stores per-list
// settings in nextconnection:user:<userId>:list:<listId> (hash: deadline).
// Before the lists migration the Dream 100 deadline lived on the user hash as
// dream100Deadline, so that's the fallback until the list has its own value.
export async function getLists(userId: string): Promise<List[]> {
  const [settings, legacyDeadline] = await Promise.all([
    Promise.all(LIST_IDS.map((id) => hgetallStrings(listKey(userId, id)))),
    db().hget<string>(userKey(userId), "dream100Deadline"),
  ]);

  return LIST_IDS.map((id, i) => {
    const stored = settings[i] ?? {};
    const deadline =
      stored.deadline ?? (id === "dream100" ? legacyDeadline ?? "" : "");
    return { id, ...LIST_DEFINITIONS[id], deadline };
  });
}

export async function setListDeadline(userId: string, listId: ListId, deadline: string): Promise<void> {
  await db().hset(listKey(userId, listId), { deadline });
}
