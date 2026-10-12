import { requireUserId } from "@/lib/dal";
import { listContacts } from "@/lib/db/contacts";
import { getLists } from "@/lib/db/lists";

export async function GET() {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  const [contacts, lists] = await Promise.all([listContacts(userId), getLists(userId)]);
  return Response.json({ contacts, lists });
}
