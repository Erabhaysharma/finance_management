import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Plus, ArrowUpRight, ArrowDownRight, AlertTriangle, Info } from "lucide-react";
import { api, fetchAll } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { mapIncome, mapExpense, mapAccount } from "../../data/adapters";
import * as A from "../analytics";
import { LIMITS } from "../expenseData";

const C = { income: "#0f766e", expense: "#d97706", ink: "#1e293b" };
const PIE = ["#0f766e", "#14b8a6", "#d97706", "#f59e0b", "#64748b", "#94a3b8", "#cbd5e1"];
const ALL = { kind: "All", account: "", method: "", state: "", source: "", category: "", etype: "", q: "" };
const RANGES = ["Today", "This week", "This month", "Custom"];
const K = (v) => (Math.abs(v) >= 1000 ? Math.round(v / 1000) + "k" : v);
const Card = ({ title, children, className = "" }) => <section className={"card " + className}>{title && <h3>{title}</h3>}{children}</section>;
const Empty = () => <div className="state-box" style={{ padding: "40px 0" }}>No data for this period.</div>;

export default function Dashboard({ onAddIncome, onAddExpense, onNavigate }) {
  const { user } = useAuth();
  const [d, setD] = useState(null), [error, setError] = useState("");
  const [period, setPeriod] = useState("This month"), [from, setFrom] = useState(""), [to, setTo] = useState("");

  useEffect(() => {
    let on = true;
    Promise.all([fetchAll("/income"), fetchAll("/expenses"), api("/accounts").catch(() => null)])   // staff may not see accounts: then cash shows "—"
      .then(([inc, exp, accts]) => on && setD({ incomes: inc.map((r) => mapIncome(r)), expenses: exp.map((r) => mapExpense(r)), accounts: accts && accts.map((a) => ({ ...mapAccount(a), balance: a.balance == null ? null : Number(a.balance) })) }))
      .catch((e) => on && setError(e.message));
    return () => { on = false; };
  }, []);

  const range = useMemo(() => { let [f, t] = A.rangeFor(period, from, to); if (f > t) [f, t] = [t, f]; return [f, t]; }, [period, from, to]);
  const all = useMemo(() => (d ? A.normalize(d.incomes, d.expenses) : []), [d]);
  const rows = useMemo(() => A.applyFilters(all, ALL, range), [all, range]);
  const prevRows = useMemo(() => A.applyFilters(all, ALL, A.previousRange(range)), [all, range]);
  const cur = A.summarize(rows), prev = A.summarize(prevRows);
  const interval = A.daysBetween(range[0], range[1]) > 62 ? "month" : "day";
  const trend = useMemo(() => A.trend(rows, interval), [rows, interval]);
  const cats = useMemo(() => A.groupSum(rows, "expense"), [rows]);
  const sources = useMemo(() => A.groupSum(rows, "income"), [rows]);
  const bud = useMemo(() => A.budget(rows, LIMITS, range[1].slice(0, 7)), [rows, range]);

  if (error) return <div className="state-box"><p>{error}</p><button className="btn" onClick={() => window.location.reload()}>Try again</button></div>;
  if (!d) return <div className="state-box" role="status">Loading dashboard…</div>;

  const name = user?.user_metadata?.name || user?.email?.split("@")[0] || "there";
  const cashAccts = (d.accounts || []).filter((a) => a.balance != null);
  const cash = d.accounts ? cashAccts.reduce((s, a) => s + a.balance, 0) : null;
  const recent = [...all].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const pending = all.filter((r) => r.open > 0).sort((a, b) => (a.due || "9").localeCompare(b.due || "9")).slice(0, 5);
  const overdue = all.filter((r) => r.overdue);
  const alerts = [];
  if (overdue.length) alerts.push({ level: "warn", text: `${overdue.length} overdue ${overdue.length === 1 ? "payment" : "payments"} totalling ${A.inr(overdue.reduce((s, r) => s + r.open, 0))}.` });
  bud.filter((b) => b.pct >= 80).forEach((b) => alerts.push({ level: b.pct > 100 ? "danger" : "warn", text: `${b.name} is at ${Math.round(b.pct)}% of its monthly limit.` }));
  if (d.accounts && cashAccts.length < d.accounts.filter((a) => a.status === "active").length) alerts.push({ level: "info", text: "Some accounts have no opening balance, so available cash is understated." });
  if (d.accounts && !d.accounts.length) alerts.push({ level: "info", text: "Add your cash and bank accounts on the Cash & accounts page to see balances." });

  const kpi = (label, value, p, inverse) => {
    const ch = p ? ((value - p) / Math.abs(p)) * 100 : null, good = ch === null ? null : inverse ? ch <= 0 : ch >= 0;
    return (
      <Card key={label} className="kpi"><span className="kpi-label">{label}</span><strong>{value == null ? "—" : A.inr(value)}</strong>
        {ch !== null && <span className={"delta " + (good ? "up" : "down")}>{ch >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(ch).toFixed(1)}% vs previous period</span>}</Card>
    );
  };

  return (
    <>
      <header className="topbar">
        <div><h1>Welcome, {name}</h1><p className="sub">Here is how your business is doing.</p></div>
        <div className="controls">
          <div className="seg">{RANGES.map((r) => <button key={r} className={period === r ? "on" : ""} onClick={() => setPeriod(r)}>{r}</button>)}</div>
          {period === "Custom" && <div className="dates"><input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} /><input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} /></div>}
        </div>
      </header>

      <div className="quick">
        <button className="btn primary" onClick={onAddIncome}><Plus size={16} /> Add income</button>
        <button className="btn" onClick={onAddExpense}><Plus size={16} /> Add expense</button>
        <button className="btn" onClick={() => onNavigate?.("accounts")}>Transfer funds</button>
        <button className="btn" onClick={() => onNavigate?.("reports")}>Export report</button>
      </div>

      <div className="kpis">
        {kpi("Total income", cur.income, prev.income)}{kpi("Total expenses", cur.expense, prev.expense, true)}
        {kpi("Operating profit", cur.net, prev.net)}{kpi("Available cash", cash)}
      </div>

      <div className="grid">
        <Card title="Income vs expenses" className="span2">
          {trend.length ? <ResponsiveContainer width="100%" height={280}><AreaChart data={trend}>
            <defs><linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.income} stopOpacity={0.25} /><stop offset="100%" stopColor={C.income} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="key" tickLine={false} axisLine={false} /><YAxis tickFormatter={K} tickLine={false} axisLine={false} />
            <Tooltip formatter={A.inr} /><Legend />
            <Area type="monotone" dataKey="income" name="Income" stroke={C.income} fill="url(#gi)" strokeWidth={2} />
            <Area type="monotone" dataKey="expense" name="Expenses" stroke={C.expense} fill="none" strokeWidth={2} />
          </AreaChart></ResponsiveContainer> : <Empty />}
        </Card>
        <Card title="Expenses by category">
          {cats.length ? <ResponsiveContainer width="100%" height={280}><PieChart>
            <Pie data={cats} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>{cats.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie>
            <Tooltip formatter={A.inr} /><Legend iconType="circle" />
          </PieChart></ResponsiveContainer> : <Empty />}
        </Card>
        <Card title="Net profit trend">
          {trend.length ? <ResponsiveContainer width="100%" height={240}><LineChart data={trend}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="key" tickLine={false} axisLine={false} /><YAxis tickFormatter={K} tickLine={false} axisLine={false} />
            <Tooltip formatter={A.inr} /><Line type="monotone" dataKey="net" name="Net profit" stroke={C.ink} strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart></ResponsiveContainer> : <Empty />}
        </Card>
        <Card title="Income by source">
          {sources.length ? <ResponsiveContainer width="100%" height={240}><BarChart data={sources} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" hide /><YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={90} /><Tooltip formatter={A.inr} />
            <Bar dataKey="value" fill={C.income} radius={[0, 4, 4, 0]} />
          </BarChart></ResponsiveContainer> : <Empty />}
        </Card>
        <Card title="Cash by account">
          {cashAccts.length ? <ResponsiveContainer width="100%" height={240}><BarChart data={cashAccts}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis tickFormatter={K} tickLine={false} axisLine={false} />
            <Tooltip formatter={A.inr} /><Bar dataKey="balance" name="Balance" fill={C.ink} radius={[4, 4, 0, 0]} />
          </BarChart></ResponsiveContainer> : <div className="state-box" style={{ padding: "40px 0" }}>{d.accounts ? "No account has an opening balance yet." : "Balances are visible to roles with account access."}</div>}
        </Card>
      </div>

      <div className="grid lists">
        <Card title="Recent transactions" className="span2">
          <table><thead><tr><th>Reference</th><th>Party</th><th>Method</th><th>Date</th><th className="r">Amount</th></tr></thead>
            <tbody>{recent.map((t) => <tr key={t.id}><td>{t.ref}</td><td>{t.party}</td><td>{t.method}</td><td>{t.date}</td><td className={"r " + t.kind}>{t.kind === "income" ? "+" : "−"}{A.inr(t.amount)}</td></tr>)}
              {!recent.length && <tr><td colSpan="5" className="empty">No transactions yet.</td></tr>}</tbody></table>
        </Card>
        <div className="stack">
          <Card title="Pending payments"><ul className="plain">
            {pending.map((p) => <li key={p.id}><div><b>{p.party}</b><small className={p.overdue ? "overdue" : ""}>{p.overdue ? `Overdue since ${p.due}` : p.due ? `Due ${p.due}` : "No due date"}</small></div><span>{A.inr(p.open)}</span></li>)}
            {!pending.length && <li className="muted">Nothing pending.</li>}</ul></Card>
          <Card title="Alerts"><ul className="plain">
            {alerts.map((a, i) => <li key={i} className={"alert " + a.level}>{a.level === "info" ? <Info size={16} /> : <AlertTriangle size={16} />}<span>{a.text}</span></li>)}
            {!alerts.length && <li className="muted">All clear.</li>}</ul></Card>
        </div>
      </div>
    </>
  );
}