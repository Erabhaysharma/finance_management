import { useCallback, useEffect, useMemo, useState } from "react";
import { Landmark, Banknote, Smartphone, Wallet, Plus, Pencil, Eye, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Download, Undo2 } from "lucide-react";
import { api, newKey } from "../accountsService";
import { summarizeAccount, runningBalances, countsAsFlow, isLive, inRange, bookBalanceAt, RECON, METHODS } from "../ledger";
import { inr, rangeFor, PERIODS } from "../analytics";
import { AccountForm, MoneyForm } from "./AccountModals";
import "./accounts.css";

const ICON = { Bank: Landmark, Cash: Banknote, "Wallet/UPI": Smartphone, Other: Wallet };
const PERIOD_OPTS = [...PERIODS.slice(0, 5), "All time", "Custom"];
const COLS = [["date", "Date"], ["ref", "Reference"], ["desc", "Description"], ["type", "Type"], ["acct", "Account"], ["method", "Method"], ["in", "Money in"], ["out", "Money out"], ["bal", "Balance"], ["recon", "Reconciliation"]];
const SORTABLE = ["date", "ref", "in", "out"];
const PAGE = 10;
const badge = (s) => <span className={"badge " + s.split(" ")[0].toLowerCase()}>{s}</span>;
const Kpi = ({ label, value, note }) => <section className="card kpi"><span className="kpi-label">{label}</span><strong>{value}</strong>{note && <span className="muted">{note}</span>}</section>;

function Reconciliation({ data, accounts, onChanged, notify }) {
  const [id, setId] = useState(accounts[0]?.id || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [stmt, setStmt] = useState("");
  const acct = accounts.find((a) => a.id === id);
  const book = acct ? bookBalanceAt(acct, data.moves, date) : null;
  const items = data.moves.filter((m) => m.accountId === id && m.date <= date).sort((a, b) => b.date.localeCompare(a.date));
  const unresolved = items.filter((m) => m.recon !== "Matched").length;
  const diff = book != null && stmt !== "" ? Math.round((Number(stmt) - book) * 100) / 100 : null;
  const history = data.recons.filter((r) => r.accountId === id).reverse();
  const guard = (p) => p.then(onChanged).catch((e) => notify(e.message, true));
  const save = () => guard(api.saveRecon({ accountId: id, statementDate: date, statementBalance: Number(stmt), bookBalance: book, diff, unresolved }, newKey()).then(() => notify("Reconciliation saved")));

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h3>Bank reconciliation</h3>
      <div className="an-filters" style={{ display: "grid" }}>
        <label>Account<select value={id} onChange={(e) => setId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>Statement date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Statement closing balance (₹)<input type="number" step="0.01" value={stmt} onChange={(e) => setStmt(e.target.value)} /></label>
      </div>
      {book == null ? <p className="muted">Configure this account's opening balance first. The book balance cannot be calculated without it.</p> : (
        <div className="summary-box"><span>Book balance <b>{inr(book)}</b></span><span>Difference <b>{diff == null ? "—" : inr(diff)}</b></span><span>Not matched <b>{unresolved}</b></span></div>
      )}
      <div className="recon-list" aria-label="Movements to match">
        {items.length ? items.map((m) => (
          <label key={m.id}><input type="checkbox" checked={m.recon === "Matched"} onChange={(e) => guard(api.setRecon(m.id, e.target.checked ? "Matched" : "Unmatched"))} />
            <span>{m.date} · {m.ref} · {m.desc}</span><b style={{ marginLeft: "auto" }}>{m.in ? "+" + inr(m.in) : "−" + inr(m.out)}</b></label>
        )) : <span className="muted">No movements up to this date.</span>}
      </div>
      <button className="btn primary" disabled={book == null || stmt === ""} onClick={save}>Save reconciliation</button>
      <p className="muted">Marked Reconciled only when the difference is zero and every movement is matched. Statement import is not available yet.</p>
      {history.length > 0 && <table><thead><tr><th>Statement date</th><th className="r">Statement</th><th className="r">Book</th><th className="r">Difference</th><th>Status</th></tr></thead>
        <tbody>{history.map((r) => <tr key={r.id}><td>{r.statementDate}</td><td className="r">{inr(r.statementBalance)}</td><td className="r">{inr(r.bookBalance)}</td><td className="r">{inr(r.diff)}</td><td>{badge(r.status)}</td></tr>)}</tbody></table>}
    </section>
  );
}

export default function AccountsPage({ onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [modal, setModal] = useState(null);
  const [sel, setSel] = useState("");
  const [p, setP] = useState({ period: "This year", from: "", to: "" });
  const [tf, setTf] = useState({ q: "", type: "", method: "", recon: "" });
  const [sort, setSort] = useState({ key: "date", dir: "desc" });
  const [page, setPage] = useState(1);

  const refresh = useCallback(() => api.getAll().then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message)), []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => setPage(1), [tf, sort, sel, p]);
  const notify = (text, bad) => { setNotice({ text, bad }); setTimeout(() => setNotice(null), 4000); };
  const saved = () => { setModal(null); refresh(); notify("Saved"); };

  const range = useMemo(() => {
    if (p.period === "All time") return ["", ""];
    let [f, t] = rangeFor(p.period, p.from, p.to);
    if (f > t) [f, t] = [t, f];
    return [f, t];
  }, [p]);

  const accounts = data?.accounts || [], moves = data?.moves || [];
  const active = accounts.filter((a) => a.status === "active");
  const name = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a.name])), [accounts]);
  const sums = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, summarizeAccount(a, moves, range)])), [accounts, moves, range]);
  const runs = useMemo(() => Object.assign({}, ...accounts.map((a) => runningBalances(a, moves))), [accounts, moves]);
  const lastRecon = (id) => (data?.recons.filter((r) => r.accountId === id).at(-1)?.status) || "Not reconciled";

  const flow = moves.filter((m) => countsAsFlow(m) && inRange(m.date, range));
  const received = flow.reduce((s, m) => s + m.in, 0), paid = flow.reduce((s, m) => s + m.out, 0);
  const configured = accounts.filter((a) => a.openingBalance != null);
  const total = configured.reduce((s, a) => s + sums[a.id].balance, 0);

  const rows = useMemo(() => {
    const q = tf.q.trim().toLowerCase();
    const list = moves.filter((m) => (!sel || m.accountId === sel) && inRange(m.date, range) && (!tf.type || m.type === tf.type) && (!tf.method || m.method === tf.method) && (!tf.recon || m.recon === tf.recon)
      && (!q || `${m.desc} ${m.ref} ${m.party} ${m.notes}`.toLowerCase().includes(q)));
    const k = sort.key;
    return list.sort((a, b) => { const c = typeof a[k] === "number" ? a[k] - b[k] : String(a[k]).localeCompare(String(b[k])) || a.seq - b.seq; return sort.dir === "asc" ? c : -c; });
  }, [moves, sel, range, tf, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE)), pg = Math.min(page, pages);

  const exportCsv = () => {
    const head = ["Date", "Reference", "Description", "Account", "Transaction type", "Money in", "Money out", "Running balance", "Reconciliation status"];
    const body = rows.map((m) => [m.date, m.ref, m.desc, name[m.accountId], m.type, m.in, m.out, runs[m.id]?.value, m.recon].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" }));
    a.download = `account-statement-${sel || "all"}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  const reverse = (m) => {
    const reason = window.prompt(`Reverse ${m.ref}? Enter a reason. A reversing entry is added and the original is kept.`);
    if (reason) api.reverse(m.id, reason, newKey()).then(() => { refresh(); notify("Reversed"); }).catch((e) => notify(e.message, true));
  };

  if (error) return <div className="state-box"><p>{error}</p><button className="btn" onClick={refresh}>Try again</button></div>;
  if (!data) return <div className="state-box" role="status">Loading accounts…</div>;
  const selAcct = accounts.find((a) => a.id === sel);
  const selSum = selAcct && summarizeAccount(selAcct, moves, ["", ""]);
  const types = [...new Set(moves.map((m) => m.type))];

  return (
    <>
      <header className="topbar">
        <div><h1>Cash &amp; Accounts</h1><p className="sub">Balances and money movement across your cash, bank and UPI accounts.</p></div>
        <div className="controls no-print">
          <button className="btn" onClick={() => setModal({ kind: "receive" })} disabled={!active.length}><ArrowDownLeft size={16} /> Receive money</button>
          <button className="btn" onClick={() => setModal({ kind: "pay" })} disabled={!active.length}><ArrowUpRight size={16} /> Pay money</button>
          <button className="btn" onClick={() => setModal({ kind: "transfer" })} disabled={active.length < 2}><ArrowLeftRight size={16} /> Transfer</button>
          <button className="btn primary" onClick={() => setModal({ kind: "account" })}><Plus size={16} /> Add account</button>
        </div>
      </header>
      {notice && <div className={"notice" + (notice.bad ? " bad" : "")} role="status">{notice.text}</div>}

      <div className="an-filters no-print" style={{ display: "grid", margin: "16px 0" }}>
        <label>Period for money in/out<select value={p.period} onChange={(e) => setP({ ...p, period: e.target.value })}>{PERIOD_OPTS.map((o) => <option key={o}>{o}</option>)}</select></label>
        {p.period === "Custom" && <><label>From<input type="date" value={p.from} onChange={(e) => setP({ ...p, from: e.target.value })} /></label><label>To<input type="date" value={p.to} onChange={(e) => setP({ ...p, to: e.target.value })} /></label></>}
      </div>

      <div className="kpis">
        <Kpi label="Total account balance" value={configured.length ? inr(total) : "Not configured"} note={configured.length < accounts.length ? `${accounts.length - configured.length} account(s) without an opening balance are excluded` : "Current book balance"} />
        <Kpi label="Money received (period)" value={inr(received)} note="Excludes transfers" />
        <Kpi label="Money paid (period)" value={inr(paid)} note="Excludes transfers" />
        <Kpi label="Net cash movement (period)" value={inr(received - paid)} note={`${moves.filter((m) => m.recon === "Needs review").length} need review`} />
      </div>

      <div className="acct-grid">
        {accounts.map((a) => {
          const s = sums[a.id], Icon = ICON[a.type] || Wallet;
          return (
            <section key={a.id} className={"card acct-card" + (sel === a.id ? " sel" : "") + (a.status === "archived" ? " dim" : "")}>
              <div className="acct-top"><span className="acct-icon"><Icon size={18} /></span><div><b>{a.name}</b><div className="muted">{a.type}{a.identifier && ` · ••••${a.identifier}`}{a.status === "archived" && " · Archived"}</div></div></div>
              <div className="acct-bal">{s.balance == null ? <span className="rel" style={{ fontSize: 14, fontWeight: 400 }}>Opening balance not configured</span> : inr(s.balance)}</div>
              <div className="acct-meta">
                <span>Opening <b>{a.openingBalance == null ? "—" : `${inr(a.openingBalance)} (${a.openingDate})`}</b></span><span>Last activity <b>{s.last || "—"}</b></span>
                <span>In (period) <b>{inr(s.in)}</b></span><span>Out (period) <b>{inr(s.out)}</b></span>
              </div>
              <div>{badge(lastRecon(a.id))}</div>
              <div className="acct-actions no-print">
                <button className="btn" onClick={() => { setSel(sel === a.id ? "" : a.id); }}><Eye size={14} /> {sel === a.id ? "Hide details" : "View details"}</button>
                <button className="btn" onClick={() => setModal({ kind: "account", account: a })}><Pencil size={14} /> Edit</button>
              </div>
            </section>
          );
        })}
      </div>

      {selAcct && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h3>{selAcct.name} · details</h3>
          <div className="summary-box" style={{ flexWrap: "wrap", gap: 12 }}>
            <span>Opening <b>{selAcct.openingBalance == null ? "Not configured" : inr(selAcct.openingBalance)}</b></span>
            <span>Posted in <b>{inr(selSum.in)}</b></span><span>Posted out <b>{inr(selSum.out)}</b></span>
            <span>Book balance <b>{selSum.balance == null ? "—" : inr(selSum.balance)}</b></span><span>{badge(lastRecon(selAcct.id))}</span>
          </div>
          <p className="muted">Posted in and out are all-time, excluding reversed entries. The statement below follows the period selected above.</p>
        </section>
      )}

      <section className="card">
        <div className="filters">
          <h3 style={{ margin: 0 }}>{selAcct ? `${selAcct.name} statement` : "All account activity"} ({rows.length})</h3>
          <button className="btn no-print" onClick={exportCsv} disabled={!rows.length}><Download size={16} /> Export CSV</button>
        </div>
        <div className="an-filters no-print" style={{ display: "grid", margin: "12px 0" }}>
          <label>Search<input type="search" placeholder="Description, party, reference" value={tf.q} onChange={(e) => setTf({ ...tf, q: e.target.value })} /></label>
          <label>Account<select value={sel} onChange={(e) => setSel(e.target.value)}><option value="">All</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label>Type<select value={tf.type} onChange={(e) => setTf({ ...tf, type: e.target.value })}><option value="">All</option>{types.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Method<select value={tf.method} onChange={(e) => setTf({ ...tf, method: e.target.value })}><option value="">All</option>{METHODS.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Reconciliation<select value={tf.recon} onChange={(e) => setTf({ ...tf, recon: e.target.value })}><option value="">All</option>{RECON.map((t) => <option key={t}>{t}</option>)}</select></label>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>{COLS.map(([k, l]) => (
              <th key={k} className={(SORTABLE.includes(k) ? "sortable " : "") + (["in", "out", "bal"].includes(k) ? "r" : "")} onClick={SORTABLE.includes(k) ? () => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "asc" ? "desc" : "asc" })) : undefined}>
                {l}{sort.key === k && (sort.dir === "asc" ? " ▲" : " ▼")}</th>))}<th className="r no-print">Actions</th></tr></thead>
            <tbody>
              {rows.slice((pg - 1) * PAGE, pg * PAGE).map((m) => {
                const run = runs[m.id], live = isLive(m);
                return (
                  <tr key={m.id} style={live ? undefined : { opacity: 0.55 }} title={m.notes || undefined}>
                    <td>{m.date}</td>
                    <td>{m.link ? <button className="chip" onClick={() => onNavigate?.(m.link.kind === "income" ? "income" : "expenses")} title="Open linked record">{m.ref}</button> : m.ref}</td>
                    <td>{m.desc}{m.reversedBy && <small className="rec"> (reversed)</small>}</td><td>{m.type}</td><td>{name[m.accountId]}</td><td>{m.method}</td>
                    <td className="r income">{m.in ? inr(m.in) : ""}</td><td className="r expense">{m.out ? inr(m.out) : ""}</td>
                    <td className={"r" + (run?.relative ? " rel" : "")} title={run?.relative ? "Opening balance not configured: net movement only" : undefined}>{run ? inr(run.value) : "—"}</td>
                    <td>{live ? <select className="status-select" value={m.recon} onChange={(e) => api.setRecon(m.id, e.target.value).then(refresh)} aria-label="Reconciliation status">{RECON.map((r) => <option key={r}>{r}</option>)}</select> : "—"}</td>
                    <td className="r no-print">{live && <div className="row-actions"><button title="Reverse" className="danger" onClick={() => reverse(m)}><Undo2 size={16} /></button></div>}</td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan="11" className="empty">No transactions match the filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pager no-print"><span>Page {pg} of {pages}</span><span style={{ display: "flex", gap: 8 }}>
          <button className="btn" disabled={pg <= 1} onClick={() => setPage(pg - 1)}>Previous</button><button className="btn" disabled={pg >= pages} onClick={() => setPage(pg + 1)}>Next</button></span></div>
      </section>

      {active.length > 0 && <Reconciliation key={active[0].id} data={data} accounts={active} onChanged={refresh} notify={notify} />}

      {modal?.kind === "account" && <AccountForm account={modal.account} onClose={() => setModal(null)} onSaved={saved} />}
      {["receive", "pay", "transfer"].includes(modal?.kind) && <MoneyForm mode={modal.kind} data={data} accounts={active} onClose={() => setModal(null)} onSaved={saved} />}
    </>
  );
}