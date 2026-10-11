import { requireUserId } from "@/lib/dal";
import { isListId } from "@/lib/contact";
import { setListDeadline } from "@/lib/db/lists";

// Update per-list settings. Today that's only the deadline (used by Dream 100).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  if (!isListId(id)) return Response.json({ error: "Unknown list" }, { status: 404 });

  const { deadline } = ((await request.json().catch(() => ({}))) ?? {}) as { deadline?: unknown };
  if (typeof deadline !== "string" || (deadline !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(deadline))) {
    return Response.json({ error: "deadline must be YYYY-MM-DD or empty" }, { status: 400 });
  }

  await setListDeadline(userId, id, deadline);
  return Response.json({ ok: true });
}
