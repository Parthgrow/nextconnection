"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_LIST_ID,
  LIST_DEFINITIONS,
  LIST_IDS,
  STATUS_OPTIONS,
  type Contact,
  type List,
  type ListId,
} from "@/lib/contact";
import { computeStats } from "@/lib/stats";
import StatsPanel from "./StatsPanel";

type Column = {
  key: keyof Contact;
  label: string;
  type: "text" | "select" | "date";
  options?: string[];
};

type View = ListId | "all";

const COLUMNS: Column[] = [
  { key: "company", label: "Company", type: "text" },
  { key: "role", label: "Role", type: "text" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
  { key: "appliedDate", label: "Applied", type: "date" },
  { key: "contactName", label: "Contact", type: "text" },
  { key: "contactEmail", label: "Contact email", type: "text" },
  { key: "link", label: "Link", type: "text" },
  { key: "nextAction", label: "Next action", type: "text" },
  { key: "nextActionDate", label: "Next action date", type: "date" },
  { key: "notes", label: "Notes", type: "text" },
];

// Legacy localStorage keys — read once on first load to migrate existing data into KV.
const STORAGE_KEY = "nextconnection.applications";
const DEADLINE_STORAGE_KEY = "nextconnection.dream100Deadline";

function emptyRow(listId: ListId): Contact {
  return {
    id: crypto.randomUUID(),
    listId,
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
    createdAt: Date.now(),
  };
}

// New rows are created with PUT; edits PATCH only the fields that changed, so
// an edit here can't overwrite a field changed elsewhere (e.g. through MCP).
async function createContact(contact: Contact) {
  await fetch(`/api/contacts/${contact.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(contact),
  });
}

async function patchContact(id: string, fields: Partial<Contact>) {
  await fetch(`/api/contacts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

function capacityOf(lists: List[], listId: ListId): number | undefined {
  return lists.find((l) => l.id === listId)?.targetCount ?? LIST_DEFINITIONS[listId].targetCount;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - startOfToday.getTime()) / 86_400_000);
}

function deadlineLabel(deadline: string): string {
  if (!deadline) return "No deadline set";
  const days = daysUntil(deadline);
  if (days > 1) return `Expires in ${days} days`;
  if (days === 1) return "Expires tomorrow";
  if (days === 0) return "Expires today";
  return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
}

export default function ApplicationsTable() {
  const [rows, setRows] = useState<Contact[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [deadline, setDeadline] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>(DEFAULT_LIST_ID);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const cellRefs = useRef<(HTMLElement | null)[][]>([]);

  const rowsRef = useRef<Contact[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Per row: the fields edited since the last save, or "new" for a row that
  // hasn't been created on the server yet.
  const dirty = useRef(new Map<string, Set<keyof Contact> | "new">());
  const deadlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function markDirty(id: string, key: keyof Contact | "new") {
    const current = dirty.current.get(id);
    if (key === "new" || current === "new") {
      dirty.current.set(id, "new");
    } else {
      dirty.current.set(id, new Set([...(current ?? []), key]));
    }
  }

  function scheduleContactSave(id: string) {
    const pending = saveTimers.current.get(id);
    if (pending) clearTimeout(pending);
    saveTimers.current.set(
      id,
      setTimeout(() => {
        saveTimers.current.delete(id);
        const contact = rowsRef.current.find((r) => r.id === id);
        const changes = dirty.current.get(id);
        dirty.current.delete(id);
        if (!contact || !changes) return;
        if (changes === "new") {
          createContact(contact);
        } else {
          patchContact(id, Object.fromEntries([...changes].map((k) => [k, contact[k]])));
        }
      }, 500)
    );
  }

  function cancelContactSave(id: string) {
    const pending = saveTimers.current.get(id);
    if (pending) {
      clearTimeout(pending);
      saveTimers.current.delete(id);
    }
    dirty.current.delete(id);
  }

  function saveDreamDeadline(value: string) {
    return fetch("/api/lists/dream100", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deadline: value }),
    });
  }

  function scheduleDeadlineSave(value: string) {
    if (deadlineTimer.current) clearTimeout(deadlineTimer.current);
    deadlineTimer.current = setTimeout(() => saveDreamDeadline(value), 500);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await fetch("/api/contacts");
      const data = (await res.json()) as { contacts: Contact[]; lists: List[] };
      if (cancelled) return;
      const dreamDeadline = data.lists.find((l) => l.id === "dream100")?.deadline ?? "";
      setLists(data.lists);

      if (data.contacts.length > 0 || dreamDeadline) {
        setRows(data.contacts);
        setDeadline(dreamDeadline);
        setLoaded(true);
        return;
      }

      // Nothing in KV yet for this browser — migrate any pre-existing localStorage data once.
      const rawRows = localStorage.getItem(STORAGE_KEY);
      const rawDeadline = localStorage.getItem(DEADLINE_STORAGE_KEY) ?? "";
      const now = Date.now();
      const localRows: Contact[] = rawRows
        ? (JSON.parse(rawRows) as (Omit<Contact, "createdAt" | "listId"> & { isDream100?: boolean })[]).map(
            ({ isDream100, ...row }, index) => ({
              ...row,
              listId: isDream100 ? "dream100" : DEFAULT_LIST_ID,
              createdAt: now + index,
            })
          )
        : [];

      if (cancelled) return;
      setRows(localRows);
      setDeadline(rawDeadline);
      setLoaded(true);

      if (localRows.length > 0) await Promise.all(localRows.map(createContact));
      if (rawDeadline) await saveDreamDeadline(rawDeadline);
      if (localRows.length > 0 || rawDeadline) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(DEADLINE_STORAGE_KEY);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeCell) return;
    cellRefs.current[activeCell.row]?.[activeCell.col]?.focus();
  }, [activeCell, editing]);

  const countIn = (listId: ListId) => rows.filter((r) => r.listId === listId).length;
  const isFull = (listId: ListId) => {
    const capacity = capacityOf(lists, listId);
    return capacity !== undefined && countIn(listId) >= capacity;
  };
  const visibleRows = view === "all" ? rows : rows.filter((r) => r.listId === view);
  const stats = computeStats(rows);
  const addTarget: ListId = view === "all" ? DEFAULT_LIST_ID : view;

  function switchView(next: View) {
    setView(next);
    setActiveCell(null);
    setEditing(false);
  }

  function setField(id: string, key: keyof Contact, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    markDirty(id, key);
    scheduleContactSave(id);
  }

  function moveToList(id: string, listId: ListId) {
    const row = rows.find((r) => r.id === id);
    if (!row || row.listId === listId || isFull(listId)) return;
    setActiveCell(null);
    setEditing(false);
    setField(id, "listId", listId);
  }

  function addRow(listId: ListId) {
    if (isFull(listId)) return;
    const row = emptyRow(listId);
    setRows((prev) => [...prev, row]);
    setActiveCell({ row: visibleRows.length, col: 0 });
    setEditing(true);
    markDirty(row.id, "new");
    scheduleContactSave(row.id);
  }

  function deleteRow(id: string) {
    cancelContactSave(id);
    setRows((prev) => prev.filter((r) => r.id !== id));
    setActiveCell(null);
    setEditing(false);
    fetch(`/api/contacts/${id}`, { method: "DELETE" });
  }

  function moveActiveCell(row: number, col: number) {
    const clampedRow = Math.max(0, Math.min(visibleRows.length - 1, row));
    const clampedCol = Math.max(0, Math.min(COLUMNS.length - 1, col));
    setEditing(false);
    setActiveCell({ row: clampedRow, col: clampedCol });
  }

  function handleSelectedKeyDown(e: React.KeyboardEvent, rowIndex: number, colIndex: number) {
    const id = visibleRows[rowIndex].id;
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        moveActiveCell(rowIndex - 1, colIndex);
        break;
      case "ArrowDown":
        e.preventDefault();
        moveActiveCell(rowIndex + 1, colIndex);
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveActiveCell(rowIndex, colIndex - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        moveActiveCell(rowIndex, colIndex + 1);
        break;
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) {
          if (colIndex === 0) moveActiveCell(rowIndex - 1, COLUMNS.length - 1);
          else moveActiveCell(rowIndex, colIndex - 1);
        } else {
          if (colIndex === COLUMNS.length - 1) moveActiveCell(rowIndex + 1, 0);
          else moveActiveCell(rowIndex, colIndex + 1);
        }
        break;
      case "Enter":
      case "F2":
        e.preventDefault();
        setEditing(true);
        break;
      case "Backspace":
      case "Delete":
        e.preventDefault();
        setField(id, COLUMNS[colIndex].key, "");
        break;
    }
  }

  function handleEditingKeyDown(e: React.KeyboardEvent, rowIndex: number, colIndex: number) {
    switch (e.key) {
      case "Enter":
        e.preventDefault();
        moveActiveCell(rowIndex + 1, colIndex);
        break;
      case "Escape":
        e.preventDefault();
        setEditing(false);
        break;
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) {
          if (colIndex === 0) moveActiveCell(rowIndex - 1, COLUMNS.length - 1);
          else moveActiveCell(rowIndex, colIndex - 1);
        } else {
          if (colIndex === COLUMNS.length - 1) moveActiveCell(rowIndex + 1, 0);
          else moveActiveCell(rowIndex, colIndex + 1);
        }
        break;
    }
  }

  function setCellRef(rowIndex: number, colIndex: number, el: HTMLElement | null) {
    if (!cellRefs.current[rowIndex]) cellRefs.current[rowIndex] = [];
    cellRefs.current[rowIndex][colIndex] = el;
  }

  const expired = deadline !== "" && daysUntil(deadline) < 0;

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap rounded-full border border-zinc-300 dark:border-zinc-700 p-0.5 text-sm">
          {[...LIST_IDS, "all" as const].map((id) => {
            const capacity = id === "all" ? undefined : capacityOf(lists, id);
            const count = id === "all" ? rows.length : countIn(id);
            const label = id === "all" ? "All" : LIST_DEFINITIONS[id].name;
            return (
              <button
                key={id}
                onClick={() => switchView(id)}
                className={`rounded-full px-3 py-1 ${
                  view === id ? "bg-black text-white dark:bg-white dark:text-black" : ""
                }`}
              >
                {label} ({count}
                {capacity ? `/${capacity}` : ""})
              </button>
            );
          })}
        </div>

        {view === "dream100" && (
          <div className="flex items-center gap-2 text-sm">
            <span className={expired ? "font-medium text-red-500" : "text-zinc-600 dark:text-zinc-400"}>
              {deadlineLabel(deadline)}
            </span>
            <input
              type="date"
              value={deadline}
              onChange={(e) => {
                setDeadline(e.target.value);
                scheduleDeadlineSave(e.target.value);
              }}
              className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black px-2 py-1 text-sm"
            />
          </div>
        )}
      </div>

      {!loaded ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : (
        <>
      <StatsPanel stats={stats} />
      <table className="border-collapse w-full text-sm">
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-left font-medium whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
            <th className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-left font-medium whitespace-nowrap">
              List
            </th>
            <th className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 w-8" />
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, rowIndex) => (
            <tr key={row.id}>
              {COLUMNS.map((col, colIndex) => {
                const isActive = activeCell?.row === rowIndex && activeCell?.col === colIndex;
                const isEditing = isActive && editing;
                const value = row[col.key] as string;

                if (isEditing && col.type === "select") {
                  return (
                    <td key={col.key} className="border border-zinc-200 dark:border-zinc-800 p-0">
                      <select
                        ref={(el) => setCellRef(rowIndex, colIndex, el)}
                        value={value}
                        onChange={(e) => setField(row.id, col.key, e.target.value)}
                        onBlur={() => setEditing(false)}
                        onKeyDown={(e) => handleEditingKeyDown(e, rowIndex, colIndex)}
                        className="w-full h-full px-2 py-1 outline-2 outline-blue-500 bg-white dark:bg-black"
                      >
                        {col.options!.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                }

                if (isEditing) {
                  return (
                    <td key={col.key} className="border border-zinc-200 dark:border-zinc-800 p-0">
                      <input
                        ref={(el) => setCellRef(rowIndex, colIndex, el)}
                        type={col.type === "date" ? "date" : "text"}
                        value={value}
                        onChange={(e) => setField(row.id, col.key, e.target.value)}
                        onBlur={() => setEditing(false)}
                        onKeyDown={(e) => handleEditingKeyDown(e, rowIndex, colIndex)}
                        className="w-full h-full px-2 py-1 outline-2 outline-blue-500 bg-white dark:bg-black"
                      />
                    </td>
                  );
                }

                return (
                  <td key={col.key} className="border border-zinc-200 dark:border-zinc-800 p-0">
                    <div
                      ref={(el) => setCellRef(rowIndex, colIndex, el)}
                      tabIndex={0}
                      onClick={() => setActiveCell({ row: rowIndex, col: colIndex })}
                      onDoubleClick={() => {
                        setActiveCell({ row: rowIndex, col: colIndex });
                        setEditing(true);
                      }}
                      onKeyDown={(e) => handleSelectedKeyDown(e, rowIndex, colIndex)}
                      className={`px-2 py-1 min-h-[28px] truncate ${
                        isActive
                          ? "outline outline-2 outline-blue-500 -outline-offset-2"
                          : "outline-none"
                      }`}
                    >
                      {value || " "}
                    </div>
                  </td>
                );
              })}
              <td className="border border-zinc-200 dark:border-zinc-800 p-0">
                <select
                  value={row.listId}
                  onChange={(e) => moveToList(row.id, e.target.value as ListId)}
                  aria-label="Move to list"
                  className="w-full bg-transparent px-1 py-1 text-sm"
                >
                  {LIST_IDS.map((id) => (
                    <option key={id} value={id} disabled={id !== row.listId && isFull(id)}>
                      {LIST_DEFINITIONS[id].name}
                      {id !== row.listId && isFull(id) ? " (full)" : ""}
                    </option>
                  ))}
                </select>
              </td>
              <td className="border border-zinc-200 dark:border-zinc-800 text-center">
                <button
                  onClick={() => deleteRow(row.id)}
                  className="text-zinc-400 hover:text-red-500 px-2"
                  aria-label="Delete row"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={() => addRow(addTarget)}
        disabled={isFull(addTarget)}
        className="self-start rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-30"
      >
        + Add to {LIST_DEFINITIONS[addTarget].name}
      </button>
        </>
      )}
    </div>
  );
}
