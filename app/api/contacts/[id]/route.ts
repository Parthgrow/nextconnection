import { requireUserId } from "@/lib/dal";
import {
  ListFullError,
  createContact,
  deleteContact,
  getContact,
  pickPatch,
  updateContact,
} from "@/lib/db/contacts";

type Params = { params: Promise<{ id: string }> };

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const badRequest = () => Response.json({ error: "Expected a JSON object" }, { status: 400 });

function listFull(err: unknown): Response | null {
  return err instanceof ListFullError ? Response.json({ error: err.message }, { status: 409 }) : null;
}

// Create (or, for an existing id, update) a contact from a full object. The
// table uses this for new rows; edits go through PATCH so only changed fields
// are written.
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  const body = await readJson(request);
  if (!body) return badRequest();

  if (body.id !== undefined && body.id !== id) {
    return Response.json({ error: "Contact id mismatch" }, { status: 400 });
  }

  try {
    const patch = pickPatch(body);
    const contact = (await getContact(userId, id))
      ? await updateContact(userId, id, patch)
      : await createContact(userId, { ...patch, id, createdAt: Number(body.createdAt) || undefined });
    return Response.json({ contact });
  } catch (err) {
    const res = listFull(err);
    if (res) return res;
    throw err;
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  const body = await readJson(request);
  if (!body) return badRequest();

  try {
    const contact = await updateContact(userId, id, pickPatch(body));
    if (!contact) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ contact });
  } catch (err) {
    const res = listFull(err);
    if (res) return res;
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  await deleteContact(userId, id);
  return Response.json({ ok: true });
}
