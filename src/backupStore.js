// Backup, snapshot and restore. Everything here is browser-side for now.
// Real automated backups need a server job (e.g. Supabase backups); restore must then be Owner-only.
import { api } from "./accountsService";

const KEYS = ["finance.notes.v1", "finance.admin.v1"];
const SNAP = "finance.backups.v1", AUTO = "finance.backups.auto";
const MAX = 10;

export async function collect() {
  const ledger = await api.getAll();
  return { app: "finance-flow", version: 1, createdAt: new Date().toISOString(), ledger, local: Object.fromEntries(KEYS.map((k) => [k, localStorage.getItem(k)])) };
}

export function validate(b) {
  if (!b || b.app !== "finance-flow") return "This is not a backup file from this app.";
  if (b.version !== 1) return `Unsupported backup version (${b.version}).`;
  const L = b.ledger;
  if (!L || !["accounts", "moves", "incomes", "expenses", "recons"].every((k) => Array.isArray(L[k]))) return "The backup is missing financial data.";
  if (!b.local || typeof b.local !== "object") return "The backup is missing settings data.";
  return "";
}

export function summary(b) {
  const n = (s) => { try { return JSON.parse(s).length; } catch { return 0; } };
  let users = 0, notes = n(b.local["finance.notes.v1"]);
  try { users = JSON.parse(b.local["finance.admin.v1"]).users.length; } catch { /* none */ }
  return { createdAt: b.createdAt, accounts: b.ledger.accounts.length, movements: b.ledger.moves.length, invoices: b.ledger.incomes.length, bills: b.ledger.expenses.length, notes, users };
}

// Replaces current data, then reloads so every store re-reads it.
export async function applyBackup(b) {
  const err = validate(b); if (err) throw new Error(err);
  KEYS.forEach((k) => (b.local[k] == null ? localStorage.removeItem(k) : localStorage.setItem(k, b.local[k])));
  if (typeof api.restore === "function") await api.restore(b.ledger);
  window.location.reload();
}

const read = () => { try { return JSON.parse(localStorage.getItem(SNAP)) || []; } catch { return []; } };
const write = (l) => localStorage.setItem(SNAP, JSON.stringify(l.slice(0, MAX)));
export const listSnapshots = () => read().map((s) => ({ ...s, bytes: JSON.stringify(s.backup).length }));
export async function saveSnapshot(source = "Manual") {
  const backup = await collect();
  write([{ id: Date.now().toString(36), source, createdAt: backup.createdAt, backup }, ...read()]);
}
export const deleteSnapshot = (id) => write(read().filter((s) => s.id !== id));
export const autoEnabled = () => localStorage.getItem(AUTO) !== "off";
export const setAutoEnabled = (on) => localStorage.setItem(AUTO, on ? "on" : "off");
// Runs when the app opens: one automatic snapshot per day.
export async function autoSnapshotIfDue() {
  if (!autoEnabled()) return false;
  const day = new Date().toISOString().slice(0, 10);
  if (read().some((s) => s.source === "Automatic" && s.createdAt.slice(0, 10) === day)) return false;
  await saveSnapshot("Automatic"); return true;
}