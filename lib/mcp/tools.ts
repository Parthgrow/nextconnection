import { kv } from "@vercel/kv";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { STATUS_OPTIONS, type Contact } from "@/lib/contact";
import { contactIndexKey, contactKey, userKey } from "@/lib/kv-keys";
import { computeStats, toDateKey } from "@/lib/stats";

// Transport-agnostic: the local stdio server (scripts/mcp-server.ts) and any
// future remote route both call this with the userId they've authenticated.
// Reads and writes use the same KV keys as app/api/*, so changes show up in
// the web app immediately.

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const status = z.enum(STATUS_OPTIONS as [string, ...string[]]);

const editableFields = {
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
  isDream100: z.boolean().optional(),
};

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function error(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

// Drop keys the caller didn't pass so a partial update never blanks a field.
function defined<T extends object>(fields: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

export function registerContactTools(server: McpServer, userId: string) {
  async function loadContacts(): Promise<Contact[]> {
    const ids = await kv.zrange<string[]>(contactIndexKey(userId), 0, -1);
    if (!ids.length) return [];
    const contacts = await Promise.all(ids.map((id) => kv.get<Contact>(contactKey(userId, id))));
    return contacts.filter((c): c is Contact => c !== null);
  }

  async function saveContact(contact: Contact) {
    await Promise.all([
      kv.set(contactKey(userId, contact.id), contact),
      kv.zadd(contactIndexKey(userId), { score: contact.createdAt, member: contact.id }),
    ]);
  }

  server.registerTool(
    "list_contacts",
    {
      description:
        "List job-search contacts/applications, oldest first. Optionally filter by status, Dream 100 membership, or a case-insensitive search over company, role, contact name and notes.",
      inputSchema: {
        status: status.optional(),
        isDream100: z.boolean().optional(),
        search: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ status, isDream100, search }) => {
      const needle = search?.toLowerCase();
      const rows = (await loadContacts()).filter(
        (c) =>
          (status === undefined || c.status === status) &&
          (isDream100 === undefined || c.isDream100 === isDream100) &&
          (!needle ||
            [c.company, c.role, c.contactName, c.notes].some((f) =>
              f?.toLowerCase().includes(needle)
            ))
      );
      return json({ count: rows.length, contacts: rows });
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
      const contact = await kv.get<Contact>(contactKey(userId, id));
      return contact ? json(contact) : error(`No contact with id ${id}`);
    }
  );

  server.registerTool(
    "add_contact",
    {
      description: `Add a new contact/application. Status defaults to "${STATUS_OPTIONS[0]}". Dates are YYYY-MM-DD.`,
      inputSchema: { ...editableFields, company: z.string().min(1) },
    },
    async (fields) => {
      const contact: Contact = {
        id: crypto.randomUUID(),
        company: "",
        role: "",
        status: STATUS_OPTIONS[0],
        appliedDate: "",
        contactName: "",
        contactEmail: "",
        link: "",
        nextAction: "",
        nextActionDate: "",
        notes: "",
        isDream100: false,
        ...defined(fields),
        createdAt: Date.now(),
      };
      await saveContact(contact);
      return json(contact);
    }
  );

  server.registerTool(
    "update_contact",
    {
      description:
        "Update fields on an existing contact. Only the fields you pass are changed; pass an empty string to clear a date.",
      inputSchema: { id: z.string(), ...editableFields },
      annotations: { idempotentHint: true },
    },
    async ({ id, ...fields }) => {
      const existing = await kv.get<Contact>(contactKey(userId, id));
      if (!existing) return error(`No contact with id ${id}`);
      const updated: Contact = { ...existing, ...defined(fields), id, createdAt: existing.createdAt };
      await saveContact(updated);
      return json(updated);
    }
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
      const existing = await kv.get<Contact>(contactKey(userId, id));
      if (!existing) return error(`No contact with id ${id}`);
      await Promise.all([
        kv.del(contactKey(userId, id)),
        kv.zrem(contactIndexKey(userId), id),
      ]);
      return json({ deleted: { id, company: existing.company, role: existing.role } });
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
      const rows = (await loadContacts())
        .filter(
          (c) =>
            c.nextActionDate &&
            c.nextActionDate <= horizon &&
            (includeClosed || (c.status !== "Rejected" && c.status !== "Offer"))
        )
        .sort((a, b) => a.nextActionDate.localeCompare(b.nextActionDate))
        .map((c) => ({
          id: c.id,
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
        "Application stats (by appliedDate): today, this week, month, year, total, current and longest daily streak, plus counts by status and Dream 100 progress.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const [contacts, deadline] = await Promise.all([
        loadContacts(),
        kv.hget<string>(userKey(userId), "dream100Deadline"),
      ]);
      const byStatus = Object.fromEntries(
        STATUS_OPTIONS.map((s) => [s, contacts.filter((c) => c.status === s).length])
      );
      return json({
        ...computeStats(contacts),
        byStatus,
        dream100: {
          count: contacts.filter((c) => c.isDream100).length,
          deadline: deadline ?? "",
        },
      });
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
      await kv.hset(userKey(userId), { dream100Deadline: deadline });
      return json({ dream100Deadline: deadline });
    }
  );
}
