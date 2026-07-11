import { kv } from "@vercel/kv";
import { getUserId } from "@/lib/session";
import { contactKey, contactIndexKey, deadlineKey } from "@/lib/kv-keys";
import type { Contact } from "@/lib/contact";

export async function GET() {
  const userId = await getUserId();

  const ids = await kv.zrange<string[]>(contactIndexKey(userId), 0, -1);

  const [contacts, deadline] = await Promise.all([
    ids.length
      ? Promise.all(ids.map((id) => kv.get<Contact>(contactKey(userId, id))))
      : Promise.resolve([]),
    kv.get<string>(deadlineKey(userId)),
  ]);

  return Response.json({
    contacts: contacts.filter((c): c is Contact => c !== null),
    deadline: deadline ?? "",
  });
}
