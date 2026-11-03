// Admin data (permissions, settings, change log), now read and written through the backend.
// Users are handled by UsersTab. Same exports the Admin and Reports pages already use.
import { useEffect, useSyncExternalStore } from "react";
import { api } from "./lib/api";

export const ROLES = ["Owner", "Admin", "Staff"];
export const MODULES = [["dashboard", "Dashboard"], ["income", "Income"], ["expenses", "Expenses"], ["analytics", "Analytics"], ["accounts", "Cash & accounts"], ["notes", "Notes"], ["reports", "Reports"], ["admin", "Admin & access"]];
export const ACTIONS = [["view", "View"], ["add", "Add"], ["edit", "Edit"], ["delete", "Delete"], ["export", "Export"]];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const blankGrid = () => Object.fromEntries(MODULES.map(([m]) => [m, Object.fromEntries(ACTIONS.map(([a]) => [a, false]))]));
let state = { users: [], perms: { Owner: blankGrid(), Admin: blankGrid(), Staff: blankGrid() }, settings: { business: "", currency: "INR", fyStart: "April", incomeSources: [], expenseCategories: [], cats: [] }, log: [] };
const subs = new Set();
const set = (p) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
const cap = (r) => r[0].toUpperCase() + r.slice(1);
export const getAdminState = () => state;

const show = (v) => (v == null ? "none" : typeof v === "object" ? JSON.stringify(v) : String(v));
function summarize(d, action) {
  if (!d) return "";
  if (action === "update") return Object.entries(d).slice(0, 3).map(([k, v]) => `${k}: ${show(v.from)} → ${show(v.to)}`).join(", ");
  return [d.ref, d.name, d.title, d.customer, d.vendor, d.description, d.business_name].filter(Boolean).join(" · ");
}

export async function loadAdmin() {
  const [perms, settings, activity] = await Promise.allSettled([api("/admin/permissions"), api("/admin/settings"), api("/admin/activity?size=200")]);
  const next = {};
  if (perms.status === "fulfilled") {
    const g = { Owner: blankGrid(), Admin: blankGrid(), Staff: blankGrid() };
    perms.value.forEach((r) => { g[cap(r.role)][r.module] = { view: r.can_view, add: r.can_add, edit: r.can_edit, delete: r.can_delete, export: r.can_export }; });
    next.perms = g;
  }
  if (settings.status === "fulfilled") {
    const { business: b, categories } = settings.value;
    next.settings = { business: b.business_name, currency: b.currency, fyStart: MONTHS[b.fy_start_month - 1], cats: categories,
      incomeSources: categories.filter((c) => c.kind === "income_source").map((c) => c.name), expenseCategories: categories.filter((c) => c.kind === "expense_category").map((c) => c.name) };
  }
  if (activity.status === "fulfilled") next.log = activity.value.items.map((l) => ({ id: l.id, at: l.at, actor: l.actor_name || "System", action: `${cap(l.action)} ${l.entity.replace(/_/g, " ")}`, detail: summarize(l.detail, l.action) }));
  set(next);
}

export const useAdmin = () => {
  const s = useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => state);
  useEffect(() => { loadAdmin(); }, []);
  return s;
};

const guard = (p) => p.then(loadAdmin).catch((e) => { window.alert(e.message); loadAdmin(); });

export const adminApi = {
  setPerm(role, mod, act, on) {
    if (role === "Owner") return;
    const row = { ...state.perms[role][mod], [act]: on };
    if (on && act !== "view") row.view = true;                       // cannot add/edit/delete/export without viewing
    if (!on && act === "view") ACTIONS.forEach(([a]) => (row[a] = false));
    set({ perms: { ...state.perms, [role]: { ...state.perms[role], [mod]: row } } }); // instant on screen, then saved
    return guard(api(`/admin/permissions/${role.toLowerCase()}/${mod}`, { method: "PUT", body: { can_view: row.view, can_add: row.add, can_edit: row.edit, can_delete: row.delete, can_export: row.export } }));
  },
  async saveSettings(s) {
    await api("/admin/settings", { method: "PUT", body: { business_name: s.business.trim(), currency: s.currency, fy_start_month: MONTHS.indexOf(s.fyStart) + 1 } });
    await loadAdmin();
  },
  async addCategory(kind, name) {
    await api("/admin/categories", { method: "POST", body: { kind: kind === "incomeSources" ? "income_source" : "expense_category", name: name.trim() } });
    await loadAdmin();
  },
  removeCategory(kind, name) {
    const k = kind === "incomeSources" ? "income_source" : "expense_category";
    const cat = state.settings.cats.find((c) => c.kind === k && c.name === name);
    return cat ? guard(api(`/admin/categories/${cat.id}`, { method: "DELETE" })) : undefined;
  },
};