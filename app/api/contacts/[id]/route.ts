import { kv } from "@vercel/kv";
import { getUserId } from "@/lib/session";
import { contactKey, contactIndexKey } from "@/lib/kv-keys";
import type { Contact } from "@/lib/contact";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getUserId();
  const contact = (await request.json()) as Contact;

  if (contact.id !== id) {
    return Response.json({ error: "Contact id mismatch" }, { status: 400 });
  }

  await Promise.all([
    kv.set(contactKey(userId, id), contact),
    kv.zadd(contactIndexKey(userId), { score: contact.createdAt, member: id }),
  ]);

  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getUserId();

  await Promise.all([
    kv.del(contactKey(userId, id)),
    kv.zrem(contactIndexKey(userId), id),
  ]);

  return Response.json({ ok: true });
}
