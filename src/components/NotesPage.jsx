import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Check, RotateCcw, Search, X } from "lucide-react";
import { useNotes, notesApi, noteState, TYPES, PRIORITIES, PRIORITY_WEIGHT, today } from "../notesStore";
import "./notes.css";

const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
const fmt = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const cls = (t) => t.toLowerCase().replace(" ", "-");
const blank = () => ({ type: "To receive", title: "", party: "", amount: "", dueDate: today(), priority: "Medium", details: "" });

function NoteForm({ initial, onClose }) {
  const [f, setF] = useState(initial ? { ...blank(), ...initial } : blank());
  const [errors, setErrors] = useState({});
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const er = {};
    if (!f.title.trim()) er.title = "Add a short title";
    if (!f.dueDate) er.dueDate = "Pick a date";
    if (f.amount !== "" && !(Number(f.amount) >= 0)) er.amount = "Enter a valid amount";
    setErrors(er);
    if (Object.keys(er).length) return;
    const note = { ...f, title: f.title.trim(), party: f.party.trim(), amount: f.amount === "" ? "" : Number(f.amount) };
    initial ? notesApi.update(initial.id, note) : notesApi.add(note);
    onClose();
  };
  const Err = ({ k }) => (errors[k] ? <span className="err">{errors[k]}</span> : null);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="drawer" onSubmit={submit} noValidate role="dialog" aria-label={initial ? "Edit note" : "Add note"}>
        <header className="drawer-head"><h2>{initial ? "Edit note" : "Add note"}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></header>
        <div className="drawer-body">
          <label>Type<select value={f.type} onChange={set("type")}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Title<input value={f.title} onChange={set("title")} autoFocus placeholder="e.g. Collect payment, pay rent" /><Err k="title" /></label>
          <label>{f.type === "To pay" ? "Vendor" : f.type === "To receive" ? "Customer" : "Person / party"} (optional)<input value={f.party} onChange={set("party")} /></label>
          <div className="row2">
            <label>Amount (₹, optional)<input type="number" min="0" step="0.01" value={f.amount} onChange={set("amount")} /><Err k="amount" /></label>
            <label>Due date<input type="date" value={f.dueDate} onChange={set("dueDate")} /><Err k="dueDate" /></label>
          </div>
          <label>Importance<select value={f.priority} onChange={set("priority")}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label>Details (optional)<textarea rows="3" value={f.details} onChange={set("details")} /></label>
          <p className="muted">When the due date passes and the note is still open, it shows as an alert on the Dashboard.</p>
        </div>
        <footer className="drawer-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary">{initial ? "Save changes" : "Save note"}</button></footer>
      </form>
    </div>
  );
}

export default function NotesPage() {
  const notes = useNotes();
  const [formFor, setFormFor] = useState(null); // null = closed, {} = new, note = edit
  const [type, setType] = useState("All");
  const [show, setShow] = useState("Open");
  const [prio, setPrio] = useState("All");
  const [q, setQ] = useState("");

  const withState = useMemo(() => notes.map((n) => ({ n, s: noteState(n) })), [notes]);
  const count = (k) => withState.filter((x) => x.s.key === k).length;
  const stats = [["overdue", "Overdue", count("overdue")], ["today", "Due today", count("today")], ["soon", "Next 3 days", count("soon")], ["done", "Done", count("done")]];

  const rows = withState
    .filter(({ n, s }) => (type === "All" || n.type === type) && (prio === "All" || n.priority === prio)
      && (show === "All" || (show === "Done" ? s.key === "done" : show === "Open" ? s.key !== "done" : s.key === show))
      && `${n.title} ${n.party} ${n.details}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (a.s.key === "done") - (b.s.key === "done") || a.n.dueDate.localeCompare(b.n.dueDate) || PRIORITY_WEIGHT[a.n.priority] - PRIORITY_WEIGHT[b.n.priority]);

  const remove = (n) => window.confirm(`Delete "${n.title}"?`) && notesApi.remove(n.id);

  return (
    <>
      <header className="topbar">
        <div><h1>Notes &amp; reminders</h1><p className="sub">Daily notes for money to receive, money to pay and other tasks. Overdue notes alert on the Dashboard.</p></div>
        <button className="btn primary" onClick={() => setFormFor({})}><Plus size={16} /> Add note</button>
      </header>

      <div className="n-stats">
        {stats.map(([k, l, c]) => (
          <section key={k} className={"card kpi" + (show === k ? " on" : "")} onClick={() => setShow(show === k ? "Open" : k)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setShow(show === k ? "Open" : k)}>
            <span className="kpi-label">{l}</span><strong className={k === "overdue" && c ? "red" : ""}>{c}</strong>
          </section>
        ))}
      </div>

      <section className="card">
        <div className="filters">
          <div className="search"><Search size={16} /><input placeholder="Search notes" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="seg">{["All", ...TYPES].map((t) => <button key={t} className={type === t ? "on" : ""} onClick={() => setType(t)}>{t}</button>)}</div>
          <select className="status-select" value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="Importance"><option value="All">All importance</option>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
          <select className="status-select" value={show} onChange={(e) => setShow(e.target.value)} aria-label="Status"><option>Open</option><option value="overdue">Overdue</option><option value="today">Due today</option><option>Done</option><option>All</option></select>
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Due date</th><th>Importance</th><th>Type</th><th>Note</th><th className="r">Amount</th><th>Status</th><th className="r">Actions</th></tr></thead>
            <tbody>
              {rows.map(({ n, s }) => (
                <tr key={n.id} className={"row-" + s.key}>
                  <td>{fmt(n.dueDate)}</td>
                  <td><span className={"badge " + n.priority.toLowerCase()}>{n.priority}</span></td>
                  <td><span className={"badge " + cls(n.type)}>{n.type}</span></td>
                  <td><b>{n.title}</b>{n.party && <div className="muted">{n.party}</div>}{n.details && <div className="muted">{n.details}</div>}</td>
                  <td className="r">{n.amount === "" || n.amount == null ? "—" : inr(n.amount)}</td>
                  <td className={"st-" + s.key}>{s.label}</td>
                  <td className="r"><div className="row-actions">
                    {s.key === "done"
                      ? <button title="Reopen" onClick={() => notesApi.setDone(n.id, false)}><RotateCcw size={16} /></button>
                      : <button title="Mark done" onClick={() => notesApi.setDone(n.id, true)}><Check size={16} /></button>}
                    <button title="Edit" onClick={() => setFormFor(n)}><Pencil size={16} /></button>
                    <button title="Delete" className="danger" onClick={() => remove(n)}><Trash2 size={16} /></button>
                  </div></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="7" className="empty">No notes here. Click Add note to create one.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {formFor && <NoteForm initial={formFor.id ? formFor : null} onClose={() => setFormFor(null)} />}
    </>
  );
}