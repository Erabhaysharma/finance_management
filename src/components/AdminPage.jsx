import { useEffect, useState } from "react";
import { Plus, Pencil, X, Lock, Search } from "lucide-react";
import { useAdmin, adminApi, ROLES, MODULES, ACTIONS, MONTHS } from "../adminStore";
import "./admin.css";

const when = (iso) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const Role = ({ r }) => <span className={"badge " + r.toLowerCase()}>{r}</span>;

function UserForm({ user, onClose }) {
  const [f, setF] = useState(user || { name: "", email: "", role: "Staff", active: true });
  const [error, setError] = useState("");
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const submit = (e) => { e.preventDefault(); try { adminApi.saveUser({ ...f, active: f.active === true || f.active === "true" }); onClose(); } catch (x) { setError(x.message); } };
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="drawer" onSubmit={submit} noValidate role="dialog" aria-label={user ? "Edit user" : "Add user"}>
        <header className="drawer-head"><h2>{user ? "Edit user" : "Add user"}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></header>
        <div className="drawer-body">
          <label>Full name<input value={f.name} onChange={set("name")} autoFocus /></label>
          <label>Email<input type="email" value={f.email} onChange={set("email")} /></label>
          <label>Role<select value={f.role} onChange={set("role")}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
          <label>Status<select value={String(f.active)} onChange={set("active")}><option value="true">Active</option><option value="false">Disabled (cannot sign in)</option></select></label>
          <p className="muted">Disabling keeps the user's history. Users are never deleted.</p>
          {error && <div className="dup" role="alert">{error}</div>}
        </div>
        <footer className="drawer-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary">{user ? "Save changes" : "Add user"}</button></footer>
      </form>
    </div>
  );
}

function Users({ users }) {
  const [form, setForm] = useState(null);
  const toggle = (u) => { try { adminApi.saveUser({ ...u, active: !u.active }); } catch (e) { window.alert(e.message); } };
  return (
    <section className="card">
      <div className="filters"><h3 style={{ margin: 0 }}>Users ({users.length})</h3><button className="btn primary" onClick={() => setForm({})}><Plus size={16} /> Add user</button></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Added</th><th className="r">Actions</th></tr></thead>
        <tbody>{users.map((u) => (
          <tr key={u.id}>
            <td><b>{u.name}</b></td><td>{u.email}</td><td><Role r={u.role} /></td>
            <td><span className={"badge " + (u.active ? "on" : "off")}>{u.active ? "Active" : "Disabled"}</span></td><td>{u.createdAt}</td>
            <td className="r"><div className="row-actions">
              <button title="Edit" onClick={() => setForm(u)}><Pencil size={16} /></button>
              <button className="btn" style={{ padding: "4px 10px" }} onClick={() => toggle(u)}>{u.active ? "Disable" : "Enable"}</button>
            </div></td>
          </tr>))}</tbody>
      </table></div>
      {form && <UserForm user={form.id ? form : null} onClose={() => setForm(null)} />}
    </section>
  );
}

function Permissions({ perms }) {
  const [role, setRole] = useState("Admin");
  const locked = role === "Owner";
  return (
    <section className="card">
      <div className="filters"><h3 style={{ margin: 0 }}>What each role can do</h3>
        <div className="seg">{ROLES.map((r) => <button key={r} className={role === r ? "on" : ""} onClick={() => setRole(r)}>{r}</button>)}</div></div>
      {locked && <div className="ad-note"><Lock size={13} style={{ verticalAlign: -2 }} /> The Owner always has full access and cannot be changed.</div>}
      <div className="ad-note">This screen records who should have access. The FastAPI backend must check these permissions on every request. Hiding a button is not security.</div>
      <div className="table-wrap"><table className="perm-table">
        <thead><tr><th>Section</th>{ACTIONS.map(([a, l]) => <th key={a}>{l}</th>)}</tr></thead>
        <tbody>{MODULES.map(([m, label]) => (
          <tr key={m}><td><b>{label}</b></td>{ACTIONS.map(([a, l]) => (
            <td key={a}><input type="checkbox" checked={perms[role][m][a]} disabled={locked} onChange={(e) => adminApi.setPerm(role, m, a, e.target.checked)} aria-label={`${role} can ${l.toLowerCase()} ${label}`} /></td>))}</tr>))}</tbody>
      </table></div>
    </section>
  );
}

function Activity({ log }) {
  const [q, setQ] = useState("");
  const rows = log.filter((l) => `${l.actor} ${l.action} ${l.detail}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <section className="card">
      <div className="filters"><h3 style={{ margin: 0 }}>Activity log</h3><div className="search"><Search size={16} /><input placeholder="Search activity" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      <p className="muted">Records changes made on this page. Income, expense and account changes will appear here once those pages report to the log.</p>
      <div className="table-wrap"><table>
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
        <tbody>{rows.map((l) => <tr key={l.id}><td>{when(l.at)}</td><td>{l.actor}</td><td><b>{l.action}</b></td><td>{l.detail}</td></tr>)}
          {!rows.length && <tr><td colSpan="4" className="empty">No activity yet.</td></tr>}</tbody>
      </table></div>
    </section>
  );
}

function CatBox({ title, kind, items }) {
  const [v, setV] = useState("");
  const add = (e) => { e.preventDefault(); try { adminApi.addCategory(kind, v); setV(""); } catch (x) { window.alert(x.message); } };
  return (
    <section className="card">
      <h3>{title}</h3>
      <div className="cat-list">{items.map((c) => <span key={c} className="cat-chip">{c}<button aria-label={`Remove ${c}`} onClick={() => window.confirm(`Remove "${c}"? Existing records keep it.`) && adminApi.removeCategory(kind, c)}><X size={14} /></button></span>)}</div>
      <form className="cat-add" onSubmit={add}><input placeholder="New name" value={v} onChange={(e) => setV(e.target.value)} aria-label={`New ${title}`} /><button className="btn">Add</button></form>
    </section>
  );
}

function Settings({ settings }) {
  const [f, setF] = useState(settings);
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => { setMsg(""); setF((p) => ({ ...p, [k]: e.target.value })); };
  const save = (e) => { e.preventDefault(); try { adminApi.saveSettings(f); setMsg("Saved"); } catch (x) { setMsg(x.message); } };
  return (
    <>
      <section className="card">
        <h3>Business settings</h3>
        <form onSubmit={save}>
          <div className="ad-form">
            <label>Business name<input value={f.business} onChange={set("business")} placeholder="Your business name" /></label>
            <label>Currency<select value={f.currency} onChange={set("currency")}><option>INR</option></select></label>
            <label>Financial year starts in<select value={f.fyStart} onChange={set("fyStart")}>{MONTHS.map((m) => <option key={m}>{m}</option>)}</select></label>
          </div>
          <p style={{ marginTop: 16 }}><button className="btn primary">Save settings</button><span className={msg === "Saved" ? "saved" : "err"}> {msg}</span></p>
        </form>
      </section>
      <div className="cat-grid">
        <CatBox title="Income sources" kind="incomeSources" items={settings.incomeSources} />
        <CatBox title="Expense categories" kind="expenseCategories" items={settings.expenseCategories} />
      </div>
      <p className="muted" style={{ marginTop: 12 }}>The Income and Expense forms still use their built-in lists. They will read these lists once they are connected to this store.</p>
    </>
  );
}

const TABS = ["Users & roles", "Permissions", "Activity log", "Business settings"];
export default function AdminPage() {
  const { users, perms, settings, log } = useAdmin();
  const [tab, setTab] = useState(TABS[0]);
  return (
    <>
      <header className="topbar"><div><h1>Admin &amp; access</h1><p className="sub">Manage who can use the system, what they can do, and how the business is set up.</p></div></header>
      <div className="seg ad-tabs" role="tablist">{TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === TABS[0] && <Users users={users} />}
      {tab === TABS[1] && <Permissions perms={perms} />}
      {tab === TABS[2] && <Activity log={log} />}
      {tab === TABS[3] && <Settings key={settings.business + settings.fyStart} settings={settings} />}
    </>
  );
}