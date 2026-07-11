import { kv } from "@vercel/kv";
import { getUserId } from "@/lib/session";
import { deadlineKey } from "@/lib/kv-keys";

export async function PUT(request: Request) {
  const userId = await getUserId();
  const { deadline } = (await request.json()) as { deadline: string };

  await kv.set(deadlineKey(userId), deadline);

  return Response.json({ ok: true });
}
