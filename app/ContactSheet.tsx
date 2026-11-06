"use client";

import { useEffect } from "react";
import {
  LIST_DEFINITIONS,
  LIST_IDS,
  STATUS_OPTIONS,
  type Contact,
  type ListId,
} from "@/lib/contact";
import { statusStyle } from "./statusStyles";

type TextField = Exclude<keyof Contact, "id" | "listId" | "createdAt" | "status" | "company">;

const FIELDS: { key: TextField; label: string; type?: "date" | "textarea" }[] = [
  { key: "role", label: "Role" },
  { key: "appliedDate", label: "Applied", type: "date" },
  { key: "contactName", label: "Contact" },
  { key: "contactEmail", label: "Contact email" },
  { key: "link", label: "Link" },
  { key: "nextAction", label: "Next action" },
  { key: "nextActionDate", label: "Next action date", type: "date" },
  { key: "notes", label: "Notes", type: "textarea" },
];

const inputClass =
  "w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500";

// Every field of one contact, editable. A bottom sheet on phones, a side
// panel on wider screens. Edits go through the same setField as the table.
export default function ContactSheet({
  contact,
  isFull,
  onChange,
  onMove,
  onDelete,
  onClose,
}: {
  contact: Contact;
  isFull: (listId: ListId) => boolean;
  onChange: (key: keyof Contact, value: string) => void;
  onMove: (listId: ListId) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const href = /^https?:\/\//.test(contact.link) ? contact.link : "";

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Contact details">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-900 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[440px] sm:rounded-none">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700 sm:hidden" />
        <div className="flex items-start gap-2 px-5 pt-4">
          <input
            value={contact.company}
            onChange={(e) => onChange("company", e.target.value)}
            placeholder="Untitled"
            aria-label="Company"
            autoFocus={!contact.company}
            className="min-w-0 flex-1 bg-transparent text-xl font-semibold text-black outline-none placeholder:text-zinc-300 dark:text-zinc-50 dark:placeholder:text-zinc-600"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 text-2xl leading-none text-zinc-400 hover:text-black dark:hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Status">
            {STATUS_OPTIONS.map((status) => {
              const selected = contact.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange("status", status)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
                    selected
                      ? statusStyle(status)
                      : "text-zinc-500 ring-zinc-200 hover:bg-zinc-50 dark:ring-zinc-700 dark:hover:bg-zinc-800"
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">List</span>
            <select
              value={contact.listId}
              onChange={(e) => onMove(e.target.value as ListId)}
              className={inputClass}
            >
              {LIST_IDS.map((id) => (
                <option key={id} value={id} disabled={id !== contact.listId && isFull(id)}>
                  {LIST_DEFINITIONS[id].name}
                  {id !== contact.listId && isFull(id) ? " (full)" : ""}
                </option>
              ))}
            </select>
          </label>

          {FIELDS.map((field) => (
            <label key={field.key} className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                {field.label}
                {field.key === "link" && href && (
                  <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                    open ↗
                  </a>
                )}
              </span>
              {field.type === "textarea" ? (
                <textarea
                  value={contact[field.key]}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  rows={5}
                  className={`${inputClass} resize-y`}
                />
              ) : (
                <input
                  type={field.type ?? "text"}
                  value={contact[field.key]}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className={inputClass}
                />
              )}
            </label>
          ))}

          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete ${contact.company.trim() || "this contact"}?`)) onDelete();
            }}
            className="self-start text-sm text-red-500 hover:underline"
          >
            Delete contact
          </button>
        </div>
      </div>
    </div>
  );
}
