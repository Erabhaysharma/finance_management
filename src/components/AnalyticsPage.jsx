import { useCallback, useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, ComposedChart, BarChart, AreaChart, Area, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell } from "recharts";
import { Download, Printer, SlidersHorizontal, RotateCcw, ArrowUp, ArrowDown } from "lucide-react";
import { seedIncomes, SOURCES, METHODS, ACCOUNTS } from "../incomeData";
import { seedExpenses, LIMITS, CATEGORIES, TYPES } from "../expenseData";
import * as A from "../analytics";
import "./analytics.css";

// Swap this for a FastAPI call later, e.g. fetch("/api/transactions").then((r) => r.json()).
const loadData = () => Promise.resolve({ incomes: seedIncomes, expenses: seedExpenses });

const FRESH = { period: "Last 30 days", from: "", to: "", kind: "All", account: "", method: "", state: "", source: "", category: "", etype: "", q: "" };
const COLS = [["date", "Date"], ["ref", "Ref"], ["kind", "Type"], ["party", "Party"], ["category", "Category"], ["method", "Method"], ["state", "Status"], ["amount", "Amount"], ["settled", "Settled"]];
const PAGE = 10;
const K = (v) => (Math.abs(v) >= 1000 ? Math.round(v / 1000) + "k" : v);
const C = { income: "#0f766e", expense: "#d97706", net: "#1e293b" };

function Sel({ label, value, onChange, options }) {
  return (
    <label>{label}
      <select value={value} onChange={onChange}>
        <option value="">All</option>
        {options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>))}
      </select>
    </label>
  );
}

function Kpi({ label, value, prev, compare, inverse }) {
  const ch = compare && prev ? ((value - prev) / Math.abs(prev)) * 100 : null;
  const good = ch === null ? null : inverse ? ch <= 0 : ch >= 0;
  return (
    <section className="card kpi">
      <span className="kpi-label">{label}</span>
      <strong>{A.inr(value)}</strong>
      {compare && (ch === null
        ? <span className="delta">No previous data</span>
        : <span className={"delta " + (good ? "up" : "down")}>{ch >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}{Math.abs(ch).toFixed(1)}% vs previous</span>)}
    </section>
  );
}

const Empty = ({ text = "No data for the selected filters." }) => <div className="state-box">{text}</div>;

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [flt, setFlt] = useState(FRESH);
  const [compare, setCompare] = useState(true);
  const [interval, setIntervalV] = useState("day");
  const [sort, setSort] = useState({ key: "date", dir: "desc" });
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(() => {
    setData(null); setError("");
    loadData().then(setData).catch((e) => setError(e.message || "Could not load data"));
  }, []);
  useEffect(load, [load]);
  useEffect(() => setPage(1), [flt, sort]);

  const set = (k) => (e) => setFlt((p) => ({ ...p, [k]: e.target.value }));
  const toggle = (k, v) => setFlt((p) => ({ ...p, [k]: p[k] === v ? "" : v })); // chart drill-down
  const onPeriod = (e) => {
    const period = e.target.value;
    setFlt((p) => { const [from, to] = A.rangeFor(p.period, p.from, p.to); return { ...p, period, from: p.from || from, to: p.to || to }; });
  };

  const range = useMemo(() => { let [f, t] = A.rangeFor(flt.period, flt.from, flt.to); if (f > t) [f, t] = [t, f]; return [f, t]; }, [flt.period, flt.from, flt.to]);
  const prevRange = useMemo(() => A.previousRange(range), [range]);
  const all = useMemo(() => (data ? A.normalize(data.incomes, data.expenses) : []), [data]);
  const rows = useMemo(() => A.applyFilters(all, flt, range), [all, flt, range]);
  const prevRows = useMemo(() => A.applyFilters(all, flt, prevRange), [all, flt, prevRange]);
  const cur = useMemo(() => A.summarize(rows), [rows]);
  const prev = useMemo(() => A.summarize(prevRows), [prevRows]);
  const trendData = useMemo(() => A.trend(rows, interval), [rows, interval]);
  const cats = useMemo(() => A.groupSum(rows, "expense"), [rows]);
  const sources = useMemo(() => A.groupSum(rows, "income"), [rows]);
  const types = useMemo(() => A.groupSum(rows, "expense", "type"), [rows]);
  const bud = useMemo(() => A.budget(rows, LIMITS, range[1].slice(0, 7)), [rows, range]);
  const age = useMemo(() => A.ageing(rows), [rows]);
  const tips = useMemo(() => A.insights(cur, prev, rows, bud, cats, compare), [cur, prev, rows, bud, cats, compare]);

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const x = a[sort.key], y = b[sort.key];
    const c = typeof x === "number" ? x - y : String(x).localeCompare(String(y));
    return sort.dir === "asc" ? c : -c;
  }), [rows, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const pg = Math.min(page, pages);

  const exportCsv = () => {
    const head = ["Date", "Ref", "Type", "Party", "Category", "Expense type", "Method", "Account", "Status", "Amount", "Settled", "Outstanding", "Due date"];
    const body = sorted.map((r) => [r.date, r.ref, r.kind, r.party, r.category, r.type, r.method, r.account, r.state + (r.overdue ? " (overdue)" : ""), r.amount, r.settled, r.open, r.due]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" }));
    a.download = `analytics-${range[0]}_to_${range[1]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (error) return <div className="state-box"><p>{error}</p><button className="btn" onClick={load}>Try again</button></div>;
  if (!data) return <div className="state-box" role="status">Loading analytics…</div>;

  const money = (v) => A.inr(v);
  const active = (k, v) => flt[k] === v;

  return (
    <>
      <header className="an-head">
        <div>
          <h1>Analytics</h1>
          <p className="sub">{range[0]} to {range[1]}{compare && ` · compared with ${prevRange[0]} to ${prevRange[1]}`}</p>
        </div>
        <div className="controls no-print">
          <button className="btn an-toggle" onClick={() => setShowFilters((s) => !s)}><SlidersHorizontal size={16} /> Filters</button>
          <label className="check" style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Compare with previous period
          </label>
          <button className="btn" onClick={exportCsv}><Download size={16} /> CSV</button>
          <button className="btn" onClick={() => window.print()}><Printer size={16} /> Print</button>
        </div>
      </header>

      <div className={"an-filters no-print" + (showFilters ? " open" : "")}>
        <Sel label="Period" value={flt.period} onChange={onPeriod} options={A.PERIODS} />
        {flt.period === "Custom" && <>
          <label>From<input type="date" value={flt.from} max={flt.to || undefined} onChange={set("from")} /></label>
          <label>To<input type="date" value={flt.to} min={flt.from || undefined} onChange={set("to")} /></label>
        </>}
        <Sel label="Transaction type" value={flt.kind === "All" ? "" : flt.kind} onChange={(e) => setFlt((p) => ({ ...p, kind: e.target.value || "All" }))} options={["Income", "Expense"]} />
        <Sel label="Account" value={flt.account} onChange={set("account")} options={[...ACCOUNTS, ["__cash", "Cash (no account)"]]} />
        <Sel label="Payment method" value={flt.method} onChange={set("method")} options={METHODS} />
        <Sel label="Payment status" value={flt.state} onChange={set("state")} options={["Settled", "Partial", "Unsettled", "Overdue"]} />
        <Sel label="Income source" value={flt.source} onChange={set("source")} options={SOURCES} />
        <Sel label="Expense category" value={flt.category} onChange={set("category")} options={CATEGORIES} />
        <Sel label="Expense type" value={flt.etype} onChange={set("etype")} options={TYPES} />
        <label>Search<input type="search" placeholder="Ref, party, notes" value={flt.q} onChange={set("q")} /></label>
        <label>&nbsp;<button className="btn" onClick={() => { setFlt(FRESH); }}><RotateCcw size={14} /> Clear all</button></label>
      </div>

      {!rows.length && <Empty />}

      <div className="an-kpis">
        <Kpi label="Recorded income" value={cur.income} prev={prev.income} compare={compare} />
        <Kpi label="Recorded expenses" value={cur.expense} prev={prev.expense} compare={compare} inverse />
        <Kpi label="Net result" value={cur.net} prev={prev.net} compare={compare} />
        <Kpi label="Cash received" value={cur.received} prev={prev.received} compare={compare} />
        <Kpi label="Cash paid" value={cur.paid} prev={prev.paid} compare={compare} inverse />
        <Kpi label="Net cash movement" value={cur.netCash} prev={prev.netCash} compare={compare} />
        <Kpi label="Receivables" value={cur.recv} prev={prev.recv} compare={compare} />
        <Kpi label="Payables" value={cur.pay} prev={prev.pay} compare={compare} inverse />
      </div>

      <div className="an-grid">
        <section className="card wide">
          <div className="filters" style={{ marginBottom: 6 }}>
            <h3 style={{ margin: 0 }}>Income vs expenses</h3>
            <div className="seg no-print">
              {["day", "week", "month"].map((i) => <button key={i} className={interval === i ? "on" : ""} onClick={() => setIntervalV(i)}>{i[0].toUpperCase() + i.slice(1)}ly</button>)}
            </div>
          </div>
          <p className="an-note">Grouped by transaction date. Full invoice and bill values, not cash.</p>
          {trendData.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={trendData}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="key" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={K} tickLine={false} axisLine={false} />
                <Tooltip formatter={money} /><Legend />
                <Bar dataKey="income" name="Income" fill={C.income} radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill={C.expense} radius={[3, 3, 0, 0]} />
                <Line dataKey="net" name="Net result" stroke={C.net} strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </section>

        <section className="card">
          <h3>Expense categories</h3>
          <p className="an-note">Click a bar to drill down. Click again to clear.</p>
          {flt.category && <div className="chip-row"><button className="chip" onClick={() => toggle("category", flt.category)}>{flt.category} ✕</button></div>}
          {cats.length ? <>
            <ResponsiveContainer width="100%" height={Math.max(160, cats.length * 36)}>
              <BarChart data={cats} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide /><YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v, n, p) => `${money(v)} (${p.payload.pct.toFixed(1)}%)`} />
                <Bar dataKey="value" name="Spent" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d) => toggle("category", d.name)}>
                  {cats.map((c) => <Cell key={c.name} fill={active("category", c.name) ? C.net : C.expense} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <table><tbody>{cats.map((c) => <tr key={c.name}><td>{c.name}</td><td className="r">{money(c.value)}</td><td className="r">{c.pct.toFixed(1)}%</td></tr>)}</tbody></table>
          </> : <Empty />}
        </section>

        <section className="card">
          <h3>Income sources</h3>
          <p className="an-note">Click a bar to filter by source.</p>
          {sources.length ? <>
            <ResponsiveContainer width="100%" height={Math.max(160, sources.length * 40)}>
              <BarChart data={sources} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide /><YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v, n, p) => `${money(v)} (${p.payload.pct.toFixed(1)}%)`} />
                <Bar dataKey="value" name="Income" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d) => toggle("source", d.name)}>
                  {sources.map((c) => <Cell key={c.name} fill={active("source", c.name) ? C.net : C.income} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <table><tbody>{sources.map((c) => <tr key={c.name}><td>{c.name}</td><td className="r">{money(c.value)}</td><td className="r">{c.pct.toFixed(1)}%</td></tr>)}</tbody></table>
          </> : <Empty />}
        </section>

        <section className="card">
          <h3>Cash-flow trend</h3>
          <p className="an-note">Settled amounts only, attributed to the transaction date. The running total starts at zero for this period and excludes opening balances.</p>
          {trendData.length ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={trendData}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="key" tickLine={false} axisLine={false} /><YAxis tickFormatter={K} tickLine={false} axisLine={false} />
                <Tooltip formatter={money} /><Legend />
                <Area dataKey="received" name="Cash received" stroke={C.income} fill={C.income} fillOpacity={0.15} />
                <Area dataKey="paid" name="Cash paid" stroke={C.expense} fill={C.expense} fillOpacity={0.15} />
                <Line dataKey="cum" name="Running net cash" stroke={C.net} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </section>

        <section className="card">
          <h3>Fixed vs variable expenses</h3>
          {types.length ? types.map((t) => (
            <div className="bar-row" key={t.name}>
              <div className="top"><span>{t.name}</span><span>{money(t.value)} · {t.pct.toFixed(1)}%</span></div>
              <div className="bar-track"><div className="bar-fill" style={{ width: t.pct + "%" }} /></div>
            </div>
          )) : <Empty />}
        </section>

        <section className="card">
          <h3>Budget utilisation</h3>
          <p className="an-note">Month of period end ({range[1].slice(0, 7)}), filtered expenses against each monthly limit.</p>
          {bud.map((b) => (
            <div className="bar-row" key={b.name}>
              <div className="top"><span>{b.name}</span><span>{money(b.used)} / {money(b.limit)} · {Math.round(b.pct)}%</span></div>
              <div className="bar-track"><div className={"bar-fill " + (b.pct > 100 ? "danger" : b.pct >= 80 ? "warn" : "")} style={{ width: Math.min(b.pct, 100) + "%" }} /></div>
            </div>
          ))}
        </section>

        <section className="card">
          <h3>Receivables and payables ageing</h3>
          <p className="an-note">Outstanding balances by days past the due date, as of today. Entries with no due date count as not due.</p>
          {cur.recv + cur.pay > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={age}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis tickFormatter={K} tickLine={false} axisLine={false} />
                <Tooltip formatter={money} /><Legend />
                <Bar dataKey="receivable" name="Receivable" fill={C.income} radius={[3, 3, 0, 0]} />
                <Bar dataKey="payable" name="Payable" fill={C.expense} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="Nothing outstanding for the selected filters." />}
        </section>

        <section className="card">
          <h3>Insights and alerts</h3>
          {tips.length ? <ul className="ins">{tips.map((t, i) => <li key={i} className={t.level}>{t.text}</li>)}</ul> : <Empty />}
        </section>
      </div>

      <section className="card">
        <h3>Transactions ({sorted.length})</h3>
        <div className="table-wrap">
          <table>
            <thead><tr>
              {COLS.map(([k, l]) => (
                <th key={k} className={"sortable" + (k === "amount" || k === "settled" ? " r" : "")} onClick={() => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "asc" ? "desc" : "asc" }))}
                  aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                  {l}{sort.key === k && (sort.dir === "asc" ? " ▲" : " ▼")}
                </th>
              ))}
            </tr></thead>
            <tbody>
              {sorted.slice((pg - 1) * PAGE, pg * PAGE).map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td><td>{r.ref}</td><td className={r.kind}>{r.kind}</td><td>{r.party}</td><td>{r.category}</td><td>{r.method}</td>
                  <td>{r.state}{r.overdue ? " · Overdue" : ""}</td><td className="r">{money(r.amount)}</td><td className="r">{money(r.settled)}</td>
                </tr>
              ))}
              {!sorted.length && <tr><td colSpan="9" className="empty">No transactions match the filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pager no-print">
          <span>Page {pg} of {pages}</span>
          <span style={{ display: "flex", gap: 8 }}>
            <button className="btn" disabled={pg <= 1} onClick={() => setPage(pg - 1)}>Previous</button>
            <button className="btn" disabled={pg >= pages} onClick={() => setPage(pg + 1)}>Next</button>
          </span>
        </div>
      </section>

      <p className="an-note" style={{ marginTop: 16 }}>
        Basis: the date filter, trends, comparison, cash figures and budget use the transaction date. Overdue flags and ageing use the due date. No payment dates are stored, so cash received and paid are attributed to the transaction date. Outstanding balances below zero are ignored; refunds and credits are not modelled.
      </p>
    </>
  );
}