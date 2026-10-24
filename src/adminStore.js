// Admin data store (users, role permissions, business settings, activity log).
// Persists in localStorage for now. Replace commit()/load() with FastAPI calls later.
// NOTE: permissions here only describe access. Real enforcement must happen on the backend.
import { useSyncExternalStore } from "react";

export const ROLES = ["Owner", "Admin", "Staff"];
export const MODULES = [["dashboard", "Dashboard"], ["income", "Income"], ["expenses", "Expenses"], ["analytics", "Analytics"], ["accounts", "Cash & accounts"], ["notes", "Notes"], ["reports", "Reports"], ["admin", "Admin & access"]];
export const ACTIONS = [["view", "View"], ["add", "Add"], ["edit", "Edit"], ["delete", "Delete"], ["export", "Export"]];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const grid = (fn) => Object.fromEntries(MODULES.map(([m]) => [m, Object.fromEntries(ACTIONS.map(([a]) => [a, !!fn(m, a)]))]));
const DEFAULTS = {
  users: [{ id: "u1", name: "Adarsh", email: "owner@yourbusiness.com", role: "Owner", active: true, createdAt: new Date().toISOString().slice(0, 10) }],
  perms: {
    Owner: grid(() => true),
    Admin: grid((m) => m !== "admin"), // everything except the Admin & access module
    Staff: grid((m, a) => (["dashboard", "notes"].includes(m) && a === "view") || (["income", "expenses", "notes"].includes(m) && ["view", "add", "edit"].includes(a))),
  },
  settings: { business: "", currency: "INR", fyStart: "April", incomeSources: ["Sales", "Services", "Commission", "Other"], expenseCategories: ["Rent", "Salaries", "Utilities", "Transport", "Marketing", "Supplies", "Miscellaneous"] },
  log: [],
};

const KEY = "finance.admin.v1";
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return DEFAULTS;
}
let state = load();
const subs = new Set();
function commit(next, action, detail) {
  const actor = next.users.find((u) => u.role === "Owner")?.name || "Admin";
  const log = action ? [{ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: new Date().toISOString(), actor, action, detail }, ...next.log].slice(0, 300) : next.log;
  state = { ...next, log };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  subs.forEach((f) => f());
}
export const useAdmin = () => useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => state);

const owners = (users) => users.filter((u) => u.role === "Owner" && u.active).length;

export const adminApi = {
  saveUser(u) {
    const email = u.email.trim().toLowerCase(), name = u.name.trim();
    if (!name) throw new Error("Name is required");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address");
    if (state.users.some((x) => x.id !== u.id && x.email.toLowerCase() === email)) throw new Error("A user with this email already exists");
    if (u.id) {
      const cur = state.users.find((x) => x.id === u.id);
      const next = state.users.map((x) => (x.id === u.id ? { ...x, name, email, role: u.role, active: u.active } : x));
      if (owners(next) < 1) throw new Error("There must be at least one active Owner");
      commit({ ...state, users: next }, "User updated", `${name} (${u.role}${u.active ? "" : ", disabled"})${cur.role !== u.role ? `, role changed from ${cur.role}` : ""}`);
    } else {
      commit({ ...state, users: [...state.users, { id: "u" + Date.now().toString(36), name, email, role: u.role, active: u.active, createdAt: new Date().toISOString().slice(0, 10) }] }, "User added", `${name} as ${u.role}`);
    }
  },
  setPerm(role, mod, act, on) {
    if (role === "Owner") return;
    const row = { ...state.perms[role][mod], [act]: on };
    if (on && act !== "view") row.view = true;            // cannot add/edit/delete/export without viewing
    if (!on && act === "view") ACTIONS.forEach(([a]) => (row[a] = false));
    commit({ ...state, perms: { ...state.perms, [role]: { ...state.perms[role], [mod]: row } } }, "Permission changed", `${role} · ${MODULES.find((m) => m[0] === mod)[1]} · ${act} ${on ? "allowed" : "removed"}`);
  },
  saveSettings(s) {
    if (!s.business.trim()) throw new Error("Business name is required");
    commit({ ...state, settings: { ...state.settings, business: s.business.trim(), currency: s.currency, fyStart: s.fyStart } }, "Settings updated", `${s.business.trim()}, ${s.currency}, financial year from ${s.fyStart}`);
  },
  addCategory(kind, name) {
    const n = name.trim(); if (!n) throw new Error("Enter a name");
    if (state.settings[kind].some((x) => x.toLowerCase() === n.toLowerCase())) throw new Error("Already exists");
    commit({ ...state, settings: { ...state.settings, [kind]: [...state.settings[kind], n] } }, "Category added", `${kind === "incomeSources" ? "Income source" : "Expense category"}: ${n}`);
  },
  removeCategory(kind, name) {
    commit({ ...state, settings: { ...state.settings, [kind]: state.settings[kind].filter((x) => x !== name) } }, "Category removed", `${kind === "incomeSources" ? "Income source" : "Expense category"}: ${name}`);
  },
};