import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  LIST_DEFINITIONS,
  LIST_IDS,
  STATUS_OPTIONS,
  type Contact,
  type ContactPatch,
  type ListId,
} from "@/lib/contact";
import { db } from "@/lib/db/client";
import {
  ListFullError,
  createContact,
  deleteContact,
  getContact,
  listContacts,
  updateContact,
} from "@/lib/db/contacts";
import { getLists, setListDeadline } from "@/lib/db/lists";
import { userKey } from "@/lib/kv-keys";
import { computeStats, toDateKey } from "@/lib/stats";

// Transport-agnostic: the local stdio server (scripts/mcp-server.ts) and the
// remote route both call this with the userId they've authenticated. All
// storage goes through lib/db, the same layer the web app uses, so changes
// show up there immediately.

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const status = z.enum(STATUS_OPTIONS as [string, ...string[]]);
const list = z
  .enum(LIST_IDS)
  .describe(
    `Which list the contact lives in (each contact is in exactly one): ${LIST_IDS.map(
      (id) => `"${id}" = ${LIST_DEFINITIONS[id].name}`
    ).join(", ")}.`
  );

const editableFields = {
  list: list.optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  status: status.optional(),
  appliedDate: dateKey.or(z.literal("")).optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  link: z.string().optional(),
  nextAction: z.string().optional(),
  nextActionDate: dateKey.or(z.literal("")).optional(),
  notes: z.string().optional(),
  isDream100: z
    .boolean()
    .optional()
    .describe('Deprecated — use list. true moves the contact to "dream100".'),
};

type EditableInput = {
  [K in keyof typeof editableFields]?: z.infer<(typeof editableFields)[K]>;
};

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function error(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function present(contact: Contact) {
  return { ...contact, list: LIST_DEFINITIONS[contact.listId].name };
}

// Tool input → storage patch: drop fields the caller didn't pass (so a partial
// update never blanks a field) and map list / legacy isDream100 to listId.
function toPatch({ list, isDream100, ...fields }: EditableInput): ContactPatch {
  const patch = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined)
  ) as ContactPatch;
  const listId: ListId | undefined = list ?? (isDream100 === true ? "dream100" : undefined);
  if (listId) patch.listId = listId;
  return patch;
}

async function catchListFull<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ListFullError) return error(err.message);
    throw err;
  }
}

export function registerContactTools(server: McpServer, userId: string) {
  server.registerTool(
    "whoami",
    {
      description: "Show which NextConnection account these tools are acting as.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const email = await db().hget<string>(userKey(userId), "email");
      return json({ userId, email: email ?? null });
    }
  );

  server.registerTool(
    "list_contacts",
    {
      description:
        "List contacts, oldest first. Optionally filter by list, status, or a case-insensitive search over company, role, contact name, email, link and notes.",
      inputSchema: {
        list: list.optional(),
        status: status.optional(),
        search: z.string().optional(),
        isDream100: z
          .boolean()
          .optional()
          .describe('Deprecated — use list: "dream100". false = every other list.'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ list, status, search, isDream100 }) => {
      const needle = search?.toLowerCase();
      const rows = (await listContacts(userId)).filter(
        (c) =>
          (list === undefined || c.listId === list) &&
          (isDream100 === undefined || (c.listId === "dream100") === isDream100) &&
          (status === undefined || c.status === status) &&
          (!needle ||
            [c.company, c.role, c.contactName, c.contactEmail, c.link, c.notes].some((f) =>
              f.toLowerCase().includes(needle)
            ))
      );
      return json({ count: rows.length, contacts: rows.map(present) });
    }
  );

  server.registerTool(
    "get_contact",
    {
      description: "Get one contact by id.",
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const contact = await getContact(userId, id);
      return contact ? json(present(contact)) : error(`No contact with id ${id}`);
    }
  );

  server.registerTool(
    "add_contact",
    {
      description: `Add a new contact. It goes in "applications" unless list says otherwise. Status defaults to "${STATUS_OPTIONS[0]}". Dates are YYYY-MM-DD. Search with list_contacts first to avoid duplicates.`,
      inputSchema: { ...editableFields, company: z.string().min(1) },
    },
    async (fields) =>
      catchListFull(async () => json(present(await createContact(userId, toPatch(fields)))))
  );

  server.registerTool(
    "update_contact",
    {
      description:
        "Update fields on an existing contact. Only the fields you pass are changed; pass an empty string to clear a date. Pass list to move it to another list.",
      inputSchema: { id: z.string(), ...editableFields },
      annotations: { idempotentHint: true },
    },
    async ({ id, ...fields }) =>
      catchListFull(async () => {
        const updated = await updateContact(userId, id, toPatch(fields));
        return updated ? json(present(updated)) : error(`No contact with id ${id}`);
      })
  );

  server.registerTool(
    "delete_contact",
    {
      description:
        "Permanently delete a contact. Requires confirm: true — confirm with the user before calling.",
      inputSchema: { id: z.string(), confirm: z.literal(true) },
      annotations: { destructiveHint: true },
    },
    async ({ id }) => {
      const deleted = await deleteContact(userId, id);
      return deleted
        ? json({ deleted: { id, company: deleted.company, role: deleted.role } })
        : error(`No contact with id ${id}`);
    }
  );

  server.registerTool(
    "get_upcoming_actions",
    {
      description:
        "List contacts with a next action that is overdue or due within the next N days (default 7), sorted by date. Excludes Rejected and Offer by default.",
      inputSchema: {
        days: z.number().int().min(0).max(365).optional(),
        includeClosed: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ days = 7, includeClosed = false }) => {
      const now = new Date();
      const today = toDateKey(now);
      const horizon = toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
      const rows = (await listContacts(userId))
        .filter(
          (c) =>
            c.nextActionDate &&
            c.nextActionDate <= horizon &&
            (includeClosed || (c.status !== "Rejected" && c.status !== "Offer"))
        )
        .sort((a, b) => a.nextActionDate.localeCompare(b.nextActionDate))
        .map((c) => ({
          id: c.id,
          list: LIST_DEFINITIONS[c.listId].name,
          company: c.company,
          role: c.role,
          status: c.status,
          nextAction: c.nextAction,
          nextActionDate: c.nextActionDate,
          overdue: c.nextActionDate < today,
        }));
      return json({ today, through: horizon, count: rows.length, actions: rows });
    }
  );

  server.registerTool(
    "get_stats",
    {
      description:
        "Application stats (by appliedDate): today, this week, month, year, total, current and longest daily streak, plus counts by status and per list (with Dream 100 progress and deadline).",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const [contacts, lists] = await Promise.all([listContacts(userId), getLists(userId)]);
      const byStatus = Object.fromEntries(
        STATUS_OPTIONS.map((s) => [s, contacts.filter((c) => c.status === s).length])
      );
      const byList = Object.fromEntries(
        lists.map((l) => [
          l.id,
          {
            name: l.name,
            count: contacts.filter((c) => c.listId === l.id).length,
            ...(l.targetCount ? { target: l.targetCount } : {}),
            ...(l.deadline ? { deadline: l.deadline } : {}),
          },
        ])
      );
      return json({ ...computeStats(contacts), byStatus, byList });
    }
  );

  server.registerTool(
    "set_dream100_deadline",
    {
      description: "Set the Dream 100 deadline (YYYY-MM-DD), or pass an empty string to clear it.",
      inputSchema: { deadline: dateKey.or(z.literal("")) },
      annotations: { idempotentHint: true },
    },
    async ({ deadline }) => {
      await setListDeadline(userId, "dream100", deadline);
      return json({ dream100Deadline: deadline });
    }
  );
}
