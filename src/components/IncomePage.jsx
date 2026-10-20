import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Download } from "lucide-react";
import IncomeForm from "/IncomeForm.jsx";
import { seedIncomes, today } from "../incomeData.js";

const inr = (n) => "₹" + n.toLocaleString("en-IN");
const fmt = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

// Overdue is derived: not fully received and past due date.
const statusOf = (i) => (i.status !== "Received" && i.due && i.due < today() ? "Overdue" : i.status);

export default function IncomePage({ formOpen, setFormOpen }) {
  const [rows, setRows] = useState(seedIncomes);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [editing, setEditing] = useState(null);
  const [partial, setPartial] = useState(null); // row being set to "Partially received"
  const [amt, setAmt] = useState("");
  const [err, setErr] = useState("");

  const customers = useMemo(() => [...new Set(rows.map((r) => r.customer))], [rows]);

  const closeForm = () => { setFormOpen(false); setEditing(null); };

  // Handles both new entries and edits.
  const save = (entry) => {
    setRows((prev) => {
      if (entry.id && prev.some((r) => r.id === entry.id)) {
        return prev.map((r) => (r.id === entry.id ? { ...r, ...entry } : r));
      }
      const n = prev.length ? Math.max(...prev.map((r) => r.id)) + 1 : 1;
      return [{ ...entry, id: n, ref: entry.ref.trim() || `INV-${1043 + n}` }, ...prev];
    });
    closeForm();
  };

  const remove = (r) => {
    if (window.confirm(`Delete ${r.ref} (${r.customer})? This cannot be undone.`)) {
      setRows((prev) => prev.filter((x) => x.id !== r.id));
    }
  };

  const updateStatus = (r, s) => {
    if (s === r.status) return;
    if (s === "Partially received") {
      setPartial(r);
      setAmt(r.received > 0 && r.received < r.amount ? String(r.received) : "");
      setErr("");
      return;
    }
    if (s === "Received" && !window.confirm(`Mark ${r.ref} as fully received (${inr(r.amount)})?`)) return;
    if (s === "Pending" && r.received > 0 && !window.confirm(`Mark ${r.ref} as pending? The ${inr(r.received)} already received will be cleared.`)) return;
    setRows((prev) => prev.map((x) =>
      x.id !== r.id ? x : s === "Received"
        ? { ...x, status: "Received", received: x.amount }
        : { ...x, status: "Pending", received: 0 }
    ));
  };

  const confirmPartial = (e) => {
    e.preventDefault();
    const n = Number(amt);
    if (!(n > 0 && n < partial.amount)) {
      setErr(`Enter an amount more than 0 and less than ${inr(partial.amount)}`);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === partial.id ? { ...r, received: n, status: "Partially received" } : r)));
    setPartial(null);
  };

  const shown = rows
    .filter((r) => filter === "All" || statusOf(r) === filter)
    .filter((r) => (r.customer + r.ref).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));

  const totals = rows.reduce(
    (t, r) => {
      t.received += r.received;
      const bal = r.amount - r.received;
      if (statusOf(r) === "Overdue") t.overdue += bal; else t.pending += bal;
      return t;
    },
    { received: 0, pending: 0, overdue: 0 }
  );

  const exportCsv = () => {
    const head = ["Reference", "Date", "Customer", "Source", "Method", "Status", "Total", "Received", "Balance", "Due date", "Notes"];
    const lines = shown.map((r) =>
      [r.ref, r.date, r.customer, r.source, r.method, statusOf(r), r.amount, r.received, r.amount - r.received, r.due, r.notes]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `income-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Income</h1>
          <p className="sub">Record and track every payment coming into the business.</p>
        </div>
        <div className="controls">
          <button className="btn" onClick={exportCsv}><Download size={16} /> Export CSV</button>
          <button className="btn primary" onClick={() => setFormOpen(true)}><Plus size={16} /> Add income</button>
        </div>
      </header>

      <div className="kpis three">
        <section className="card kpi"><span className="kpi-label">Received</span><strong>{inr(totals.received)}</strong></section>
        <section className="card kpi"><span className="kpi-label">Pending</span><strong>{inr(totals.pending)}</strong></section>
        <section className="card kpi"><span className="kpi-label">Overdue</span><strong className="red">{inr(totals.overdue)}</strong></section>
      </div>

      <section className="card">
        <div className="filters">
          <div className="search"><Search size={16} />
            <input placeholder="Search customer or invoice no." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="seg">
            {["All", "Received", "Partially received", "Pending", "Overdue"].map((s) => (
              <button key={s} className={filter === s ? "on" : ""} onClick={() => setFilter(s)}>{s}</button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th><th>Date</th><th>Customer</th><th>Source</th><th>Method</th>
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
                    <td>{r.customer}</td>
                    <td>{r.source}</td>
                    <td>{r.method}</td>
                    <td><span className={"badge " + st.split(" ")[0].toLowerCase()}>{st}</span></td>
                    <td className="r">{inr(r.amount)}</td>
                    <td className="r">{r.amount - r.received ? inr(r.amount - r.received) : "—"}</td>
                    <td className="r">
                      <div className="row-actions">
                        <select
                          className="status-select"
                          value={r.status}
                          onChange={(e) => updateStatus(r, e.target.value)}
                          aria-label={`Update status of ${r.ref}`}
                        >
                          <option>Received</option>
                          <option>Partially received</option>
                          <option>Pending</option>
                        </select>
                        <button title="Edit" onClick={() => setEditing(r)}><Pencil size={16} /></button>
                        <button title="Delete" className="danger" onClick={() => remove(r)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan="9" className="empty">No income entries found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <IncomeForm
        open={formOpen || !!editing}
        initial={editing}
        onClose={closeForm}
        onSave={save}
        customers={customers}
        existing={rows}
      />

      {partial && (
        <div className="overlay center" onMouseDown={(e) => e.target === e.currentTarget && setPartial(null)}>
          <form className="dialog" onSubmit={confirmPartial}>
            <h3>Partial payment: {partial.ref}</h3>
            <p className="sub">{partial.customer} · Total {inr(partial.amount)}</p>
            <label>Total received so far (₹)
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