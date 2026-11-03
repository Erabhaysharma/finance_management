import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Send, X } from "lucide-react";
import { api } from "../lib/api";
import "./admin.css";

const ROLES = ["staff", "admin", "owner"];
const cap = (r) => r[0].toUpperCase() + r.slice(1);
const Role = ({ r }) => <span className={"badge " + r}>{cap(r)}</span>;

function UserForm({ user, onClose, onDone }) {
  const editing = !!user;
  const [f, setF] = useState(user ? { name: user.name, email: user.email, role: user.role, active: user.active } : { name: "", email: "", role: "staff", active: true });
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setError("");
    if (!f.name.trim()) return setError("Enter the person's name.");
    if (!editing && !/^\S+@\S+\.\S+$/.test(f.email.trim())) return setError("Enter a valid email address.");
    setBusy(true);
    try {
      if (editing) await api(`/admin/users/${user.id}`, { method: "PATCH", body: { name: f.name.trim(), role: f.role, active: f.active === true || f.active === "true" } });
      else await api("/admin/users", { method: "POST", body: { name: f.name.trim(), email: f.email.trim(), role: f.role } });
      onDone(editing ? "User updated." : `Invitation sent to ${f.email.trim()}. They will set their own password from the email.`);
    } catch (x) { setError(x.message); setBusy(false); }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="drawer" onSubmit={submit} noValidate role="dialog" aria-label={editing ? "Edit user" : "Invite user"}>
        <header className="drawer-head"><h2>{editing ? "Edit user" : "Invite user"}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></header>
        <div className="drawer-body">
          <label>Full name<input value={f.name} onChange={set("name")} autoFocus /></label>
          <label>Email<input type="email" value={f.email} onChange={set("email")} disabled={editing} /></label>
          <label>Role<select value={f.role} onChange={set("role")}>{ROLES.map((r) => <option key={r} value={r}>{cap(r)}</option>)}</select></label>
          {editing && <label>Status<select value={String(f.active)} onChange={set("active")}><option value="true">Active</option><option value="false">Disabled (cannot use the app)</option></select></label>}
          {!editing && <p className="muted">They get an email with a secure link to choose their own password. You never see or share a password.</p>}
          {error && <div className="dup" role="alert">{error}</div>}
        </div>
        <footer className="drawer-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? "Please wait…" : editing ? "Save changes" : "Send invitation"}</button></footer>
      </form>
    </div>
  );
}

export default function UsersTab() {
  const [users, setUsers] = useState(null), [error, setError] = useState(""), [form, setForm] = useState(null), [notice, setNotice] = useState(null);
  const load = useCallback(() => api("/admin/users").then((u) => { setUsers(u); setError(""); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const say = (text, bad) => { setNotice({ text, bad }); setTimeout(() => setNotice(null), 6000); };

  const act = (fn, ok) => fn().then(() => { load(); say(ok); }).catch((e) => say(e.message, true));
  const toggle = (u) => act(() => api(`/admin/users/${u.id}`, { method: "PATCH", body: { active: !u.active } }), u.active ? `${u.name} is disabled.` : `${u.name} is enabled.`);
  const sendLink = (u) => window.confirm(`Email ${u.email} a link to set or reset their password?`) && act(() => api(`/admin/users/${u.id}/send-link`, { method: "POST" }), `Password link sent to ${u.email}.`);

  if (error) return <div className="state-box"><p>{error}</p><button className="btn" onClick={load}>Try again</button></div>;
  if (!users) return <div className="state-box" role="status">Loading users…</div>;
  return (
    <section className="card">
      <div className="filters"><h3 style={{ margin: 0 }}>Users ({users.length})</h3><button className="btn primary" onClick={() => setForm({})}><Plus size={16} /> Invite user</button></div>
      <p className="muted">New users receive an email invitation and set their own password. If someone loses access, use Send link.</p>
      {notice && <div className={"auth-msg " + (notice.bad ? "bad" : "good")} role="status" style={{ margin: "8px 0" }}>{notice.text}</div>}
      <div className="table-wrap"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th className="r">Actions</th></tr></thead>
        <tbody>{users.map((u) => (
          <tr key={u.id}>
            <td><b>{u.name}</b></td><td>{u.email}</td><td><Role r={u.role} /></td>
            <td><span className={"badge " + (u.active ? "on" : "off")}>{u.active ? "Active" : "Disabled"}</span></td>
            <td className="r"><div className="row-actions">
              <button title="Edit" onClick={() => setForm(u)}><Pencil size={16} /></button>
              <button title="Send password link" onClick={() => sendLink(u)}><Send size={16} /></button>
              <button className="btn" style={{ padding: "4px 10px" }} onClick={() => toggle(u)}>{u.active ? "Disable" : "Enable"}</button>
            </div></td>
          </tr>))}</tbody>
      </table></div>
      {form && <UserForm user={form.id ? form : null} onClose={() => setForm(null)} onDone={(m) => { setForm(null); load(); say(m); }} />}
    </section>
  );
}