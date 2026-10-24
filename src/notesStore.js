// Shared notes store, so the Notes page and the Dashboard alert see the same data.
// Persists in localStorage for now. Replace commit()/load() with FastAPI calls later.
import { useEffect, useState, useSyncExternalStore } from "react";

export const TYPES = ["To receive", "To pay", "Other"];
export const PRIORITIES = ["High", "Medium", "Low"];
const KEY = "finance.notes.v1";

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const today = () => ymd(new Date());
const shift = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
export const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 864e5);

// Sample notes, only used the first time (delete them freely).
const seed = () => [
  { id: "n1", type: "To receive", title: "Collect balance payment", party: "Verma Retail", amount: 36000, dueDate: shift(-3), priority: "High", details: "Promised by last Friday", status: "Open", createdAt: shift(-10) },
  { id: "n2", type: "To pay", title: "Pay electricity bill", party: "City Power Board", amount: 8600, dueDate: shift(0), priority: "Medium", details: "", status: "Open", createdAt: shift(-4) },
  { id: "n3", type: "Other", title: "Call CA about GST filing", party: "", amount: "", dueDate: shift(5), priority: "Low", details: "", status: "Open", createdAt: shift(-1) },
];

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return seed();
}
let notes = load();
const subs = new Set();
function commit(next) {
  notes = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  subs.forEach((f) => f());
}

export const notesApi = {
  add: (n) => commit([{ ...n, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), status: "Open", createdAt: today() }, ...notes]),
  update: (id, patch) => commit(notes.map((n) => (n.id === id ? { ...n, ...patch } : n))),
  remove: (id) => commit(notes.filter((n) => n.id !== id)),
  setDone: (id, done) => commit(notes.map((n) => (n.id === id ? { ...n, status: done ? "Done" : "Open", doneAt: done ? today() : "" } : n))),
};

// Re-renders every minute so a note turns "overdue" after midnight without a refresh.
export function useNotes() {
  const list = useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => notes);
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(i); }, []);
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
export const PRIORITY_WEIGHT = { High: 0, Medium: 1, Low: 2 };