import { kv } from "@vercel/kv";
import { requireUserId } from "@/lib/dal";
import { contactKey, contactIndexKey, userKey } from "@/lib/kv-keys";
import type { Contact } from "@/lib/contact";

export async function GET() {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  const ids = await kv.zrange<string[]>(contactIndexKey(userId), 0, -1);

  const [contacts, dream100Deadline] = await Promise.all([
    ids.length
      ? Promise.all(ids.map((id) => kv.get<Contact>(contactKey(userId, id))))
      : Promise.resolve([]),
    kv.hget<string>(userKey(userId), "dream100Deadline"),
  ]);

  return Response.json({
    contacts: contacts.filter((c): c is Contact => c !== null),
    deadline: dream100Deadline ?? "",
  });
}
