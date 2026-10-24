import { useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { api } from "../accountsService";
import { useAdmin } from "../adminStore";
import { plReport, statement, balanceSheet, downloadCsv } from "../reportsLogic";
import { inr, rangeFor, previousRange, PERIODS } from "../analytics";
import BackupPanel from "./BackupPanel";
import "./reports.css";

const PERIOD_OPTS = [...PERIODS.slice(0, 5), "Custom"];
const pct = (c, p) => (p ? (((c - p) / Math.abs(p)) * 100).toFixed(1) + "%" : "—");
const Amt = ({ v }) => <span className={v < 0 ? "neg" : ""}>{inr(v)}</span>;
const REPORTS = ["Profit & Loss", "Account statement", "Balance sheet"];

function Head({ title, line, business }) {
  return <div className="rp-print-head"><h2>{business || "Business"}</h2><b>{title}</b><div>{line}</div></div>;
}

export default function ReportsPage() {
  const { settings } = useAdmin();
  const [data, setData] = useState(null), [error, setError] = useState("");
  const [view, setView] = useState("Reports"), [report, setReport] = useState(REPORTS[0]);
  const [p, setP] = useState({ period: "This month", from: "", to: "" });
  const [basis, setBasis] = useState("accrual"), [acctId, setAcctId] = useState("");

  const load = () => api.getAll().then((d) => { setData(d); setError(""); setAcctId((x) => x || d.accounts[0]?.id || ""); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const range = useMemo(() => { let [f, t] = rangeFor(p.period, p.from, p.to); if (f > t) [f, t] = [t, f]; return [f, t]; }, [p]);
  const prev = useMemo(() => previousRange(range), [range]);
  const pl = useMemo(() => data && plReport(data.incomes, data.expenses, range, basis), [data, range, basis]);
  const plPrev = useMemo(() => data && plReport(data.incomes, data.expenses, prev, basis), [data, prev, basis]);
  const acct = data?.accounts.find((a) => a.id === acctId);
  const st = useMemo(() => (acct ? statement(acct, data.moves, range) : null), [acct, data, range]);
  const bs = useMemo(() => data && balanceSheet(data.accounts, data.moves, data.incomes, data.expenses), [data]);

  if (error) return <div className="state-box"><p>{error}</p><button className="btn" onClick={load}>Try again</button></div>;
  if (!data) return <div className="state-box" role="status">Loading reports…</div>;

  const line = `${range[0]} to ${range[1]}`;
  const plRows = () => {
    const keys = (k) => [...new Set([...Object.keys(pl[k]), ...Object.keys(plPrev[k])])];
    return [["Item", "Current", "Previous", "Change %"],
      ...keys("income").map((k) => ["Revenue: " + k, pl.income[k] || 0, plPrev.income[k] || 0, pct(pl.income[k] || 0, plPrev.income[k] || 0)]),
      ["Total revenue", pl.revenue, plPrev.revenue, pct(pl.revenue, plPrev.revenue)],
      ...keys("expense").map((k) => ["Expense: " + k, pl.expense[k] || 0, plPrev.expense[k] || 0, pct(pl.expense[k] || 0, plPrev.expense[k] || 0)]),
      ["Total expenses", pl.costs, plPrev.costs, pct(pl.costs, plPrev.costs)], ["Net profit / loss", pl.net, plPrev.net, pct(pl.net, plPrev.net)]];
  };
  const exportCsv = () => {
    if (report === "Profit & Loss") downloadCsv(`profit-loss-${range[0]}_${range[1]}-${basis}.csv`, plRows());
    else if (report === "Account statement" && st) downloadCsv(`account-statement-${acct.name}-${range[0]}_${range[1]}.csv`, [["Date", "Reference", "Description", "Money in", "Money out", "Running balance"], ...st.lines.map((l) => [l.date, l.ref, l.desc, l.in, l.out, l.running])]);
    else downloadCsv("balance-sheet.csv", [["Item", "Amount"], ...bs.cashRows.map((r) => [r.name, r.balance]), ["Receivables", bs.recv], ["Total assets", bs.assets], ["Payables", bs.pay], ["Net position", bs.net]]);
  };
  const Row = ({ label, cur, pv, cls, indent }) => <tr className={cls}><td className={indent ? "indent" : ""}>{label}</td><td className="r"><Amt v={cur} /></td><td className="r"><Amt v={pv} /></td><td className="r">{pct(cur, pv)}</td></tr>;

  return (
    <>
      <header className="topbar no-print"><div><h1>Reports &amp; backups</h1><p className="sub">Financial reports you can export or print, and backups of your data.</p></div></header>
      <div className="seg no-print" style={{ margin: "20px 0 4px", display: "inline-flex" }}>{["Reports", "Backups"].map((v) => <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{v}</button>)}</div>

      {view === "Backups" ? <BackupPanel /> : <>
        <div className="rp-top no-print">
          <label>Report<select value={report} onChange={(e) => setReport(e.target.value)}>{REPORTS.map((r) => <option key={r}>{r}</option>)}</select></label>
          {report !== "Balance sheet" && <label>Period<select value={p.period} onChange={(e) => setP({ ...p, period: e.target.value })}>{PERIOD_OPTS.map((o) => <option key={o}>{o}</option>)}</select></label>}
          {report !== "Balance sheet" && p.period === "Custom" && <><label>From<input type="date" value={p.from} onChange={(e) => setP({ ...p, from: e.target.value })} /></label><label>To<input type="date" value={p.to} onChange={(e) => setP({ ...p, to: e.target.value })} /></label></>}
          {report === "Profit & Loss" && <label>Basis<select value={basis} onChange={(e) => setBasis(e.target.value)}><option value="accrual">Invoiced and billed</option><option value="cash">Cash received and paid</option></select></label>}
          {report === "Account statement" && <label>Account<select value={acctId} onChange={(e) => setAcctId(e.target.value)}>{data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
          <button className="btn" onClick={exportCsv}><Download size={16} /> Export CSV</button>
          <button className="btn primary" onClick={() => window.print()}><Printer size={16} /> Print / Save as PDF</button>
        </div>

        <section className="card rp-sheet">
          {report === "Profit & Loss" && <>
            <Head title="Profit & Loss" line={`${line} · ${basis === "cash" ? "Cash basis" : "Invoiced and billed basis"}`} business={settings.business} />
            <h2 className="no-print">Profit &amp; Loss</h2><p className="sub no-print">{line} · compared with {prev[0]} to {prev[1]}</p>
            <table><thead><tr><th>Item</th><th className="r">Current</th><th className="r">Previous</th><th className="r">Change</th></tr></thead><tbody>
              <tr className="sec"><td colSpan="4">Revenue</td></tr>
              {Object.keys({ ...pl.income, ...plPrev.income }).map((k) => <Row key={k} indent label={k} cur={pl.income[k] || 0} pv={plPrev.income[k] || 0} />)}
              <Row cls="sub" label="Total revenue" cur={pl.revenue} pv={plPrev.revenue} />
              <tr className="sec"><td colSpan="4">Expenses</td></tr>
              {Object.keys({ ...pl.expense, ...plPrev.expense }).map((k) => <Row key={k} indent label={k} cur={pl.expense[k] || 0} pv={plPrev.expense[k] || 0} />)}
              <Row cls="sub" label="Total expenses" cur={pl.costs} pv={plPrev.costs} />
              <Row cls="grand" label="Net profit / loss" cur={pl.net} pv={plPrev.net} />
              <tr><td>Profit margin</td><td className="r">{pl.margin == null ? "—" : pl.margin.toFixed(1) + "%"}</td><td className="r">{plPrev.margin == null ? "—" : plPrev.margin.toFixed(1) + "%"}</td><td /></tr>
              <tr><td>Fixed / variable expenses</td><td className="r">{inr(pl.fixed)} / {inr(pl.variable)}</td><td className="r">{inr(plPrev.fixed)} / {inr(plPrev.variable)}</td><td /></tr>
            </tbody></table>
            <p className="muted">{basis === "cash" ? "Uses the amounts actually received and paid, placed on the transaction date (payment dates are not stored)." : "Uses full invoice and bill amounts by transaction date, whether or not they are settled."} Loans, owner capital and owner drawings are not part of profit.</p>
          </>}

          {report === "Account statement" && (!acct ? <p className="muted">No accounts yet.</p> : <>
            <Head title={`Account statement: ${acct.name}`} line={line} business={settings.business} />
            <h2 className="no-print">{acct.name}</h2><p className="sub no-print">{acct.type} · {line}</p>
            {st.opening == null && <div className="warnbox">Opening balance is not configured for this account, so no opening or closing balance is shown. Running balance shows net movement only. Set it on the Cash &amp; accounts page.</div>}
            <div className="bk-sum"><span>Opening balance <b>{st.opening == null ? "Not configured" : inr(st.opening)}</b></span><span>Closing balance <b>{st.closing == null ? "—" : inr(st.closing)}</b></span><span>Total money in <b>{inr(st.totalIn)}</b></span><span>Total money out <b>{inr(st.totalOut)}</b></span></div>
            <div className="table-wrap"><table><thead><tr><th>Date</th><th>Reference</th><th>Description</th><th className="r">In</th><th className="r">Out</th><th className="r">{st.opening == null ? "Net so far" : "Balance"}</th></tr></thead>
              <tbody>{st.lines.map((l) => <tr key={l.id}><td>{l.date}</td><td>{l.ref}</td><td>{l.desc}</td><td className="r">{l.in ? inr(l.in) : ""}</td><td className="r">{l.out ? inr(l.out) : ""}</td><td className="r"><Amt v={l.running} /></td></tr>)}
                {!st.lines.length && <tr><td colSpan="6" className="empty">No movements in this period.</td></tr>}</tbody></table></div>
          </>)}

          {report === "Balance sheet" && <>
            <Head title="Balance sheet (simplified management report)" line={`As of ${new Date().toISOString().slice(0, 10)}`} business={settings.business} />
            <h2 className="no-print">Balance sheet</h2><p className="sub no-print">Simplified management report as of today. Not a statutory balance sheet.</p>
            {bs.missing.length > 0 && <div className="warnbox">Opening balance not configured for: {bs.missing.join(", ")}. These are left out of cash, so assets are understated.</div>}
            <table><tbody>
              <tr className="sec"><td colSpan="2">Assets</td></tr>
              {bs.cashRows.map((r) => <tr key={r.id}><td className="indent">{r.name} ({r.type})</td><td className="r"><Amt v={r.balance} /></td></tr>)}
              <tr><td className="indent">Receivables (unpaid invoices)</td><td className="r">{inr(bs.recv)}</td></tr>
              <tr className="sub"><td>Total assets</td><td className="r">{inr(bs.assets)}</td></tr>
              <tr className="sec"><td colSpan="2">Liabilities</td></tr>
              <tr><td className="indent">Payables (unpaid bills)</td><td className="r">{inr(bs.pay)}</td></tr>
              <tr className="sub"><td>Total liabilities</td><td className="r">{inr(bs.pay)}</td></tr>
              <tr className="grand"><td>Net position (assets − liabilities)</td><td className="r"><Amt v={bs.net} /></td></tr>
            </tbody></table>
            <p className="muted">Not included: fixed assets, stock, loans, owner capital and tax. Add those before using this for audit, tax or bank purposes, and have your accountant review it.</p>
          </>}
        </section>
      </>}
    </>
  );
}