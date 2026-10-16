export const STATUS_OPTIONS = ["Wishlist", "Applied", "Interviewing", "Offer", "Rejected"];

// Every contact lives in exactly one list (one-to-many). The set is fixed for
// now, so ids are stable slugs rather than generated UUIDs.
export const LIST_IDS = ["applications", "dream100", "leads", "noida-agencies"] as const;
export type ListId = (typeof LIST_IDS)[number];
export const DEFAULT_LIST_ID: ListId = "applications";

export const LIST_DEFINITIONS: Record<ListId, { name: string; targetCount?: number }> = {
  applications: { name: "Applications" },
  dream100: { name: "Dream 100", targetCount: 100 },
  leads: { name: "Leads" },
  "noida-agencies": { name: "Digital marketing agencies in Noida" },
};

export function isListId(value: unknown): value is ListId {
  return typeof value === "string" && (LIST_IDS as readonly string[]).includes(value);
}

export type List = {
  id: ListId;
  name: string;
  targetCount?: number;
  deadline: string; // YYYY-MM-DD or ""
};

export type Contact = {
  id: string;
  listId: ListId;
  company: string;
  role: string;
  status: string;
  appliedDate: string;
  contactName: string;
  contactEmail: string;
  link: string;
  nextAction: string;
  nextActionDate: string;
  notes: string;
  createdAt: number;
};

export const CONTACT_TEXT_FIELDS = [
  "company",
  "role",
  "status",
  "appliedDate",
  "contactName",
  "contactEmail",
  "link",
  "nextAction",
  "nextActionDate",
  "notes",
] as const satisfies readonly (keyof Contact)[];

// What callers may change: everything except identity and creation time.
export type ContactPatch = Partial<Omit<Contact, "id" | "createdAt">>;
