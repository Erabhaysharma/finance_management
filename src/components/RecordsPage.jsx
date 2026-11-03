import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Pencil, Trash2, Download, Wallet } from "lucide-react";
import { api, fetchAll } from "../lib/api";
import { mapIncome, mapExpense } from "../../data/adapters.js";
import { useLookups } from "../../data/session";
import { newKey } from "../accountsService";
import RecordForm from "./RecordForm.jsx";

// Everything that differs between the Income and Expenses pages.
const KINDS = {
  income: { path: "/income", pay: "/ledger/receive", map: mapIncome, title: "Income", sub: "Record and track every payment coming into the business.", add: "Add income", noun: "income",
    party: "customer", partyLabel: "Customer", cat: "source", catLabel: "Income source", settled: "received", statuses: ["Received", "Partially received", "Pending"],
    doneWord: "received", doneCap: "Received", accountLabel: "Deposited into account", payTitle: "Record payment received", hasType: false, search: "Search customer or invoice no.", cats: "sources" },
  expenses: { path: "/expenses", pay: "/ledger/pay", map: mapExpense, title: "Expenses", sub: "Record and track every payment going out of the business.", add: "Add expense", noun: "expense",
    party: "vendor", partyLabel: "Vendor / payee", cat: "category", catLabel: "Category", settled: "paid", statuses: ["Paid", "Partially paid", "Unpaid"],
    doneWord: "paid", doneCap: "Paid", accountLabel: "Paid from account", payTitle: "Record payment made", hasType: true, search: "Search vendor or bill no.", cats: "categories" },
};
const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
const fmt = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function RecordsPage({ kind, formOpen, setFormOpen }) {
  const k = KINDS[kind];
  const lk = useLookups();
  const [raw, setRaw] = useState(null), [error, setError] = useState(""), [notice, setNotice] = useState(null);
  const [q, setQ] = useState(""), [filter, setFilter] = useState("All"), [category, setCategory] = useState("All");
  const [editing, setEditing] = useState(null), [pay, setPay] = useState(null);

  const load = useCallback(() => fetchAll(k.path).then((r) => { setRaw(r); setError(""); }).catch((e) => setError(e.message)), [k.path]);
  useEffect(() => { setRaw(null); load(); }, [load]);
  const say = (text, bad) => { setNotice({ text, bad }); setTimeout(() => setNotice(null), 6000); };

  const names = useMemo(() => Object.fromEntries(lk.accounts.map((a) => [a.id, a.name])), [lk.accounts]);
  const rows = useMemo(() => (raw || []).map((r) => k.map(r, names)), [raw, names, k]);
  const statusOf = (r) => (r.status !== k.statuses[0] && r.due && r.due < todayStr() ? "Overdue" : r.status);
  const settledOf = (r) => r[k.settled];
  const parties = useMemo(() => [...new Set(rows.map((r) => r[k.party]))], [rows, k.party]);

  const shown = rows.filter((r) => (filter === "All" || statusOf(r) === filter) && (category === "All" || r[k.cat] === category)
    && (r[k.party] + r.ref).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date));
  const month = todayStr().slice(0, 7);
  const t = rows.reduce((s, r) => {
    if (r.date.slice(0, 7) === month) s.month += r.amount;
    s.settled += settledOf(r);
    const bal = r.amount - settledOf(r);
    if (statusOf(r) === "Overdue") s.overdue += bal; else s.open += bal;
    return s;
  }, { month: 0, settled: 0, open: 0, overdue: 0 });

  const closeForm = () => { setFormOpen(false); setEditing(null); };
  const remove = async (r) => {
    if (!window.confirm(`Delete ${r.ref} (${r[k.party]})? This cannot be undone.`)) return;
    try { await api(`${k.path}/${r.id}`, { method: "DELETE" }); load(); say("Deleted."); } catch (e) { say(e.message, true); }
  };
  const exportCsv = () => {
    const head = ["Reference", "Date", k.partyLabel, k.catLabel, "Method", "Status", "Total", k.doneCap, "Balance", "Due date", "Notes"];
    const lines = shown.map((r) => [r.ref, r.date, r[k.party], r[k.cat], r.method, statusOf(r), r.amount, settledOf(r), r.amount - settledOf(r), r.due, r.notes].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + [head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `${kind}-${todayStr()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  if (error) return <div className="state-box"><p>{error}</p><button className="btn" onClick={load}>Try again</button></div>;
  if (!raw) return <div className="state-box" role="status">Loading {k.title.toLowerCase()}…</div>;

  return (
    <>
      <header className="topbar">
        <div><h1>{k.title}</h1><p className="sub">{k.sub}</p></div>
        <div className="controls">
          <button className="btn" onClick={exportCsv}><Download size={16} /> Export CSV</button>
          <button className="btn primary" onClick={() => setFormOpen(true)}><Plus size={16} /> {k.add}</button>
        </div>
      </header>
      {notice && <div className={"auth-msg " + (notice.bad ? "bad" : "good")} role="status" style={{ marginTop: 12 }}>{notice.text}</div>}

      <div className="kpis mt">
        <section className="card kpi"><span className="kpi-label">This month</span><strong>{inr(t.month)}</strong></section>
        <section className="card kpi"><span className="kpi-label">{k.doneCap}</span><strong>{inr(t.settled)}</strong></section>
        <section className="card kpi"><span className="kpi-label">Outstanding</span><strong>{inr(t.open)}</strong></section>
        <section className="card kpi"><span className="kpi-label">Overdue</span><strong className="red">{inr(t.overdue)}</strong></section>
      </div>

      <section className="card">
        <div className="filters">
          <div className="search"><Search size={16} /><input placeholder={k.search} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="status-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label={`Filter by ${k.catLabel}`}><option>All</option>{lk[k.cats].map((c) => <option key={c}>{c}</option>)}</select>
          <div className="seg">{["All", ...k.statuses, "Overdue"].map((s) => <button key={s} className={filter === s ? "on" : ""} onClick={() => setFilter(s)}>{s}</button>)}</div>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Reference</th><th>Date</th><th>{k.partyLabel}</th><th>{k.catLabel}</th>{k.hasType && <th>Type</th>}<th>Method</th><th>Status</th><th className="r">Total</th><th className="r">Balance</th><th className="r">Actions</th></tr></thead>
          <tbody>
            {shown.map((r) => {
              const st = statusOf(r), bal = r.amount - settledOf(r);
              return (
                <tr key={r.id}>
                  <td>{r.ref}{r.repeat && <small className="rec"> ↻ {r.frequency}</small>}</td><td>{fmt(r.date)}</td><td>{r[k.party]}</td><td>{r[k.cat]}</td>{k.hasType && <td>{r.type}</td>}<td>{r.method}</td>
                  <td><span className={"badge " + st.split(" ")[0].toLowerCase()}>{st}</span></td>
                  <td className="r">{inr(r.amount)}</td><td className="r">{bal > 0 ? inr(bal) : "—"}</td>
                  <td className="r"><div className="row-actions">
                    {bal > 0 && <button title={k.payTitle} onClick={() => setPay(r)}><Wallet size={16} /></button>}
                    <button title="Edit" onClick={() => setEditing(r)}><Pencil size={16} /></button>
                    <button title="Delete" className="danger" onClick={() => remove(r)}><Trash2 size={16} /></button>
                  </div></td>
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={k.hasType ? 10 : 9} className="empty">Nothing here yet.</td></tr>}
          </tbody>
        </table></div>
      </section>

      <RecordForm k={k} open={formOpen || !!editing} initial={editing} onClose={closeForm} parties={parties} categories={lk[k.cats]} accounts={lk.accounts}
        onSaved={(m, bad) => { closeForm(); load(); say(m, bad); }} />
      {pay && <PayDialog k={k} row={pay} accounts={lk.accounts} onClose={() => setPay(null)} onDone={(m) => { setPay(null); load(); say(m); }} />}
    </>
  );
}

function PayDialog({ k, row, accounts, onClose, onDone }) {
  const active = accounts.filter((a) => a.status === "active");
  const balance = row.amount - row[k.settled];
  const [f, setF] = useState({ amount: String(Math.round(balance * 100) / 100), date: todayStr(), accountId: row.accountId && active.some((a) => a.id === row.accountId) ? row.accountId : active[0]?.id || "", method: row.method });
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const set = (x) => (e) => setF((p) => ({ ...p, [x]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setError("");
    const n = Number(f.amount);
    if (!(n > 0) || n > balance + 0.004) return setError(`Enter an amount between 0 and ${inr(balance)}.`);
    if (!f.accountId) return setError("Choose an account.");
    setBusy(true);
    try { await api(k.pay, { method: "POST", body: { date: f.date, amount: String(n), account_id: f.accountId, method: f.method, link_id: row.id, idempotency_key: key.current } }); onDone("Payment recorded."); }
    catch (x) { setError(x.message); setBusy(false); }
  };
  return (
    <div className="overlay center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog" onSubmit={submit}>
        <h3>{k.payTitle}: {row.ref}</h3>
        <p className="sub">{row[k.party]} · Balance {inr(balance)}</p>
        <label>Amount (₹)<input type="number" min="0" step="0.01" value={f.amount} onChange={set("amount")} autoFocus /></label>
        <label>Date<input type="date" value={f.date} onChange={set("date")} /></label>
        <label>{k.accountLabel}<select value={f.accountId} onChange={set("accountId")}><option value="">Select account…</option>{active.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>Method<select value={f.method} onChange={set("method")}>{["Cash", "Bank", "UPI", "Card"].map((m) => <option key={m}>{m}</option>)}</select></label>
        {error && <span className="err">{error}</span>}
        <div className="dialog-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Record"}</button></div>
      </form>
    </div>
  );
}