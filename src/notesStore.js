// Notes, now stored in the database through the backend. Same exports the Notes page and dashboard alert already use.
import { useEffect, useState, useSyncExternalStore } from "react";
import { api } from "./lib/api";

export const TYPES = ["To receive", "To pay", "Other"];
export const PRIORITIES = ["High", "Medium", "Low"];
export const PRIORITY_WEIGHT = { High: 0, Medium: 1, Low: 2 };

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const today = () => ymd(new Date());
export const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 864e5);

const fromApi = (n) => ({ id: n.id, type: n.type, title: n.title, party: n.party || "", amount: n.amount == null ? "" : Number(n.amount), dueDate: n.due_date, priority: n.priority, details: n.details || "", status: n.status, createdAt: (n.created_at || "").slice(0, 10) });
const toApi = (n) => ({ type: n.type, title: n.title, party: n.party || null, amount: n.amount === "" || n.amount == null ? null : String(n.amount), due_date: n.dueDate, priority: n.priority, details: n.details || null });

let notes = [];
const subs = new Set();
export const getNotes = () => notes;
export async function refreshNotes() {
  try { notes = (await api("/notes")).map(fromApi); subs.forEach((f) => f()); } catch { /* signed out, or no access to notes */ }
}
const run = (p) => p.then(refreshNotes).catch((e) => window.alert(e.message));

export const notesApi = {
  add: (n) => run(api("/notes", { method: "POST", body: toApi(n) })),
  update: (id, n) => run(api(`/notes/${id}`, { method: "PATCH", body: toApi(n) })),
  setDone: (id, done) => run(api(`/notes/${id}`, { method: "PATCH", body: { status: done ? "Done" : "Open" } })),
  remove: (id) => run(api(`/notes/${id}`, { method: "DELETE" })),
};

// Loads on mount and every minute, so another user's changes and midnight rollovers show up without a refresh.
export function useNotes() {
  const list = useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => notes);
  const [, tick] = useState(0);
  useEffect(() => {
    refreshNotes();
    const i = setInterval(() => { tick((x) => x + 1); refreshNotes(); }, 60000);
    return () => clearInterval(i);
  }, []);
  return list;
}

// overdue = open and the due date has passed (strictly before today).
export function noteState(n) {
  if (n.status === "Done") return { key: "done", days: 0, label: "Done" };
  const d = daysBetween(n.dueDate, today());
  if (d > 0) return { key: "overdue", days: d, label: `${d} day${d > 1 ? "s" : ""} overdue` };
  if (d === 0) return { key: "today", days: 0, label: "Due today" };
  return { key: d >= -3 ? "soon" : "later", days: d, label: `In ${-d} day${d < -1 ? "s" : ""}` };
}