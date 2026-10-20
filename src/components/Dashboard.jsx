import { useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { Plus, ArrowUpRight, ArrowDownRight, AlertTriangle, Info } from "lucide-react";
import {
  kpis, monthly, expenseByCategory, incomeBySource, accounts,
  transactions, pending, alerts,
} from "../data";

const C = { income: "#0f766e", expense: "#d97706", ink: "#1e293b", mute: "#94a3b8" };
const PIE = ["#0f766e", "#14b8a6", "#d97706", "#f59e0b", "#64748b", "#94a3b8", "#cbd5e1"];
const inr = (n) => "₹" + n.toLocaleString("en-IN");
const RANGES = ["Today", "This week", "This month", "Custom"];

const trend = monthly.map((d) => ({ ...d, profit: d.income - d.expense }));

function Card({ title, children, className = "" }) {
  return (
    <section className={"card " + className}>
      {title && <h3>{title}</h3>}
      {children}
    </section>
  );
}

export default function Dashboard( onAddIncome) {
  const [range, setRange] = useState("This month");

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Welcome, Adarsh</h1>
          <p className="sub">Here is how your business is doing.</p>
        </div>
        <div className="controls">
          <div className="seg">
            {RANGES.map((r) => (
              <button key={r} className={range === r ? "on" : ""} onClick={() => setRange(r)}>
                {r}
              </button>
            ))}
          </div>
          {range === "Custom" && (
            <div className="dates">
              <input type="date" aria-label="From date" />
              <input type="date" aria-label="To date" />
            </div>
          )}
        </div>
      </header>

      <div className="quick">
        <button className="btn primary" onClick={onAddIncome}><Plus size={16} /> Add income</button>
        <button className="btn"><Plus size={16} /> Add expense</button>
        <button className="btn">Transfer funds</button>
        <button className="btn">Export report</button>
      </div>

      <div className="kpis">
        {kpis.map((k) => {
          const up = k.change >= 0;
          return (
            <Card key={k.key} className="kpi">
              <span className="kpi-label">{k.label}</span>
              <strong>{inr(k.value)}</strong>
              <span className={"delta " + (up ? "up" : "down")}>
                {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(k.change)}% vs last period
              </span>
            </Card>
          );
        })}
      </div>

      <div className="grid">
        <Card title="Income vs expenses" className="span2">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthly}>
              <defs>
                <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.income} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={C.income} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="m" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => v / 1000 + "k"} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => inr(v)} />
              <Legend />
              <Area type="monotone" dataKey="income" name="Income" stroke={C.income} fill="url(#gi)" strokeWidth={2} />
              <Area type="monotone" dataKey="expense" name="Expenses" stroke={C.expense} fill="none" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Expenses by category">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={expenseByCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {expenseByCategory.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => inr(v)} />
              <Legend iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Net profit trend">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="m" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => v / 1000 + "k"} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => inr(v)} />
              <Line type="monotone" dataKey="profit" name="Net profit" stroke={C.ink} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Income by source">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={incomeBySource} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={90} />
              <Tooltip formatter={(v) => inr(v)} />
              <Bar dataKey="value" fill={C.income} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Cash by account">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={accounts}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => v / 1000 + "k"} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => inr(v)} />
              <Bar dataKey="value" fill={C.ink} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid lists">
        <Card title="Recent transactions" className="span2">
          <table>
            <thead>
              <tr><th>Reference</th><th>Party</th><th>Method</th><th>Date</th><th className="r">Amount</th></tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td><td>{t.party}</td><td>{t.method}</td><td>{t.date}</td>
                  <td className={"r " + t.type}>{t.type === "income" ? "+" : "−"}{inr(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="stack">
          <Card title="Pending payments">
            <ul className="plain">
              {pending.map((p) => (
                <li key={p.id}>
                  <div><b>{p.party}</b><small className={p.status}>{p.due}</small></div>
                  <span>{inr(p.amount)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Alerts">
            <ul className="plain">
              {alerts.map((a, i) => (
                <li key={i} className={"alert " + a.level}>
                  {a.level === "info" ? <Info size={16} /> : <AlertTriangle size={16} />}
                  <span>{a.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
