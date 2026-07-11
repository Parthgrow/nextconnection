import { kv } from "@vercel/kv";
import { requireUserId } from "@/lib/dal";
import { userKey } from "@/lib/kv-keys";

export async function PUT(request: Request) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  const { deadline } = (await request.json()) as { deadline: string };

  await kv.hset(userKey(userId), { dream100Deadline: deadline });

  return Response.json({ ok: true });
}
