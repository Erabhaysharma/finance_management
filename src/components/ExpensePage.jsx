import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Download } from "lucide-react";
import ExpenseForm from "./ExpenseForm.jsx";
import { seedExpenses, today, CATEGORIES } from "../expenseData";

const inr = (n) => "₹" + n.toLocaleString("en-IN");
const fmt = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

// Overdue is derived: not fully paid and past due date.
const statusOf = (e) => (e.status !== "Paid" && e.due && e.due < today() ? "Overdue" : e.status);

export default function ExpensePage({ formOpen, setFormOpen }) {
  const [rows, setRows] = useState(seedExpenses);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [category, setCategory] = useState("All");
  const [editing, setEditing] = useState(null);
  const [partial, setPartial] = useState(null);
  const [amt, setAmt] = useState("");
  const [err, setErr] = useState("");

  const vendors = useMemo(() => [...new Set(rows.map((r) => r.vendor))], [rows]);

  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const save = (entry) => {
    setRows((prev) => {
      if (entry.id && prev.some((r) => r.id === entry.id)) {
        return prev.map((r) => (r.id === entry.id ? { ...r, ...entry } : r));
      }
      const n = prev.length ? Math.max(...prev.map((r) => r.id)) + 1 : 1;
      return [{ ...entry, id: n, ref: entry.ref.trim() || `EXP-${400 + n}` }, ...prev];
    });
    closeForm();
  };

  const remove = (r) => {
    if (window.confirm(`Delete ${r.ref} (${r.vendor})? This cannot be undone.`)) {
      setRows((prev) => prev.filter((x) => x.id !== r.id));
    }
  };

  const updateStatus = (r, s) => {
    if (s === r.status) return;
    if (s === "Partially paid") {
      setPartial(r);
      setAmt(r.paid > 0 && r.paid < r.amount ? String(r.paid) : "");
      setErr("");
      return;
    }
    if (s === "Paid" && !window.confirm(`Mark ${r.ref} as fully paid (${inr(r.amount)})?`)) return;
    if (s === "Unpaid" && r.paid > 0 && !window.confirm(`Mark ${r.ref} as unpaid? The ${inr(r.paid)} already paid will be cleared.`)) return;
    setRows((prev) => prev.map((x) =>
      x.id !== r.id ? x : s === "Paid" ? { ...x, status: "Paid", paid: x.amount } : { ...x, status: "Unpaid", paid: 0 }
    ));
  };

  const confirmPartial = (e) => {
    e.preventDefault();
    const n = Number(amt);
    if (!(n > 0 && n < partial.amount)) {
      setErr(`Enter an amount more than 0 and less than ${inr(partial.amount)}`);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === partial.id ? { ...r, paid: n, status: "Partially paid" } : r)));
    setPartial(null);
  };

  const shown = rows
    .filter((r) => filter === "All" || statusOf(r) === filter)
    .filter((r) => category === "All" || r.category === category)
    .filter((r) => (r.vendor + r.ref).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));

  const month = today().slice(0, 7);
  const totals = rows.reduce(
    (t, r) => {
      if (r.date.slice(0, 7) === month) t.month += r.amount;
      t.paid += r.paid;
      const bal = r.amount - r.paid;
      if (statusOf(r) === "Overdue") t.overdue += bal; else t.unpaid += bal;
      return t;
    },
    { month: 0, paid: 0, unpaid: 0, overdue: 0 }
  );

  const exportCsv = () => {
    const head = ["Reference", "Date", "Vendor", "Category", "Type", "Method", "Status", "Total", "Paid", "Balance", "Due date", "Notes"];
    const lines = shown.map((r) =>
      [r.ref, r.date, r.vendor, r.category, r.type, r.method, statusOf(r), r.amount, r.paid, r.amount - r.paid, r.due, r.notes]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `expenses-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Expenses</h1>
          <p className="sub">Record and track every payment going out of the business.</p>
        </div>
        <div className="controls">
          <button className="btn" onClick={exportCsv}><Download size={16} /> Export CSV</button>
          <button className="btn primary" onClick={() => setFormOpen(true)}><Plus size={16} /> Add expense</button>
        </div>
      </header>

      <div className="kpis mt">
        <section className="card kpi"><span className="kpi-label">Spent this month</span><strong>{inr(totals.month)}</strong></section>
        <section className="card kpi"><span className="kpi-label">Paid</span><strong>{inr(totals.paid)}</strong></section>
        <section className="card kpi"><span className="kpi-label">Unpaid</span><strong>{inr(totals.unpaid)}</strong></section>
        <section className="card kpi"><span className="kpi-label">Overdue</span><strong className="red">{inr(totals.overdue)}</strong></section>
      </div>

      <section className="card">
        <div className="filters">
          <div className="search"><Search size={16} />
            <input placeholder="Search vendor or bill no." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="status-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
            <option>All</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <div className="seg">
            {["All", "Paid", "Partially paid", "Unpaid", "Overdue"].map((s) => (
              <button key={s} className={filter === s ? "on" : ""} onClick={() => setFilter(s)}>{s}</button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th><th>Date</th><th>Vendor</th><th>Category</th><th>Type</th><th>Method</th>
                <th>Status</th><th className="r">Total</th><th className="r">Balance</th><th className="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const st = statusOf(r);
                return (
                  <tr key={r.id}>
                    <td>{r.ref}{r.repeat && <small className="rec"> ↻ {r.frequency}</small>}</td>
                    <td>{fmt(r.date)}</td>
                    <td>{r.vendor}</td>
                    <td>{r.category}</td>
                    <td>{r.type}</td>
                    <td>{r.method}</td>
                    <td><span className={"badge " + st.split(" ")[0].toLowerCase()}>{st}</span></td>
                    <td className="r">{inr(r.amount)}</td>
                    <td className="r">{r.amount - r.paid ? inr(r.amount - r.paid) : "—"}</td>
                    <td className="r">
                      <div className="row-actions">
                        <select className="status-select" value={r.status} onChange={(e) => updateStatus(r, e.target.value)} aria-label={`Update status of ${r.ref}`}>
                          <option>Paid</option>
                          <option>Partially paid</option>
                          <option>Unpaid</option>
                        </select>
                        <button title="Edit" onClick={() => setEditing(r)}><Pencil size={16} /></button>
                        <button title="Delete" className="danger" onClick={() => remove(r)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan="10" className="empty">No expenses found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <ExpenseForm
        open={formOpen || !!editing}
        initial={editing}
        onClose={closeForm}
        onSave={save}
        vendors={vendors}
        existing={rows}
      />

      {partial && (
        <div className="overlay center" onMouseDown={(e) => e.target === e.currentTarget && setPartial(null)}>
          <form className="dialog" onSubmit={confirmPartial}>
            <h3>Partial payment: {partial.ref}</h3>
            <p className="sub">{partial.vendor} · Total {inr(partial.amount)}</p>
            <label>Total paid so far (₹)
              <input type="number" min="0" step="0.01" value={amt} onChange={(e) => setAmt(e.target.value)} autoFocus />
            </label>
            {err && <span className="err">{err}</span>}
            <div className="dialog-foot">
              <button type="button" className="btn" onClick={() => setPartial(null)}>Cancel</button>
              <button type="submit" className="btn primary">Save</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}