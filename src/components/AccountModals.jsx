import { useRef, useState } from "react";
import { X } from "lucide-react";
import { api, newKey } from "../accountsService";
import { ACCOUNT_TYPES, IN_TYPES, OUT_TYPES, METHODS, validateMoney, r2 } from "../ledger";
import { inr, todayStr } from "../analytics";

function Shell({ title, onClose, onSubmit, busy, submitText, error, children }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="drawer" onSubmit={onSubmit} noValidate role="dialog" aria-label={title}>
        <header className="drawer-head"><h2>{title}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></header>
        <div className="drawer-body">{children}{error && <div className="dup" role="alert">{error}</div>}</div>
        <footer className="drawer-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? "Saving…" : submitText}</button></footer>
      </form>
    </div>
  );
}
const Err = ({ m }) => (m ? <span className="err">{m}</span> : null);

export function AccountForm({ account, onClose, onSaved }) {
  const key = useRef(newKey()), adjKey = useRef(newKey());
  const configured = account?.openingBalance != null;
  const [f, setF] = useState({ name: account?.name || "", type: account?.type || "Bank", openingBalance: configured ? String(account.openingBalance) : "", openingDate: account?.openingDate || todayStr(), identifier: account?.identifier || "", notes: account?.notes || "", status: account?.status || "active" });
  const [adj, setAdj] = useState({ amount: "", date: todayStr(), reason: "" });
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: k === "identifier" ? e.target.value.replace(/\D/g, "").slice(0, 4) : e.target.value }));

  const run = async (fn) => { setBusy(true); setError(""); try { await fn(); onSaved(); } catch (e) { setError(e.message); setBusy(false); } };
  const submit = (e) => { e.preventDefault();
    const ob = f.openingBalance.trim() === "" ? null : Number(f.openingBalance);
    run(() => api.saveAccount({ ...account, ...f, name: f.name, openingBalance: ob, currency: "INR" }, key.current));
  };

  return (
    <Shell title={account ? "Edit account" : "Add account"} onClose={onClose} onSubmit={submit} busy={busy} submitText="Save account" error={error}>
      <label>Account name<input value={f.name} onChange={set("name")} autoFocus /></label>
      <div className="row2">
        <label>Type<select value={f.type} onChange={set("type")}>{ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label>Currency<input value="INR" disabled /></label>
      </div>
      <div className="row2">
        <label>Opening balance (₹){configured && " · locked"}<input type="number" step="0.01" value={f.openingBalance} onChange={set("openingBalance")} disabled={configured} placeholder="Not configured" /></label>
        <label>Opening date<input type="date" value={f.openingDate} onChange={set("openingDate")} disabled={configured} /></label>
      </div>
      <label>Account identifier, last 4 digits (optional)<input value={f.identifier} onChange={set("identifier")} inputMode="numeric" placeholder="1234" /></label>
      <label>Notes<textarea rows="2" value={f.notes} onChange={set("notes")} /></label>
      {account && <label>Status<select value={f.status} onChange={set("status")}><option value="active">Active</option><option value="archived">Archived (keeps history, no new transactions)</option></select></label>}
      {configured && (
        <div className="summary-box" style={{ flexDirection: "column", gap: 8 }}>
          <b>Balance adjustment</b>
          <span className="muted">The opening balance is never overwritten. Post a dated adjustment instead (negative reduces the balance).</span>
          <div className="row2"><input type="number" step="0.01" placeholder="Amount" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} /><input type="date" value={adj.date} onChange={(e) => setAdj({ ...adj, date: e.target.value })} /></div>
          <input placeholder="Reason" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} />
          <button type="button" className="btn" disabled={busy} onClick={() => run(() => api.adjust({ accountId: account.id, ...adj, amount: Number(adj.amount) }, adjKey.current))}>Post adjustment</button>
        </div>
      )}
    </Shell>
  );
}

const TITLES = { receive: "Receive money", pay: "Pay money", transfer: "Transfer between accounts" };
export function MoneyForm({ mode, data, accounts, onClose, onSaved }) {
  const key = useRef(newKey());
  const inc = mode === "receive", k = inc ? "received" : "paid";
  const [f, setF] = useState({ date: todayStr(), amount: "", accountId: accounts[0]?.id || "", fromId: accounts[0]?.id || "", toId: "", method: "Bank", type: inc ? IN_TYPES[0] : OUT_TYPES[0], party: "", linkId: "", ref: "", notes: "" });
  const [errors, setErrors] = useState({}), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const set = (x) => (e) => setF((p) => ({ ...p, [x]: e.target.value }));
  const records = (inc ? data.incomes : data.expenses).filter((r) => r.amount - r[k] > 0.004);
  const rec = records.find((r) => String(r.id) === f.linkId);
  const link = rec && { outstanding: r2(rec.amount - rec[k]) };
  const onLink = (e) => {
    const r = records.find((x) => String(x.id) === e.target.value);
    setF((p) => ({ ...p, linkId: e.target.value, amount: r ? String(r2(r.amount - r[k])) : p.amount, party: r ? (inc ? r.customer : r.vendor) : p.party }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validateMoney(mode, f, { account: accounts.find((a) => a.id === f.accountId), link });
    setErrors(errs); setError("");
    if (Object.keys(errs).length) return;
    const amt = Number(f.amount);
    if (amt >= 100000 && !window.confirm(`Confirm ${TITLES[mode].toLowerCase()} of ${inr(amt)}? This can only be undone by a reversal.`)) return;
    setBusy(true);
    try { await (mode === "transfer" ? api.transfer(f, key.current) : api.money(mode, f, key.current)); onSaved(); }
    catch (x) { setError(x.message); setBusy(false); }
  };
  const Acc = ({ id, label }) => (
    <label>{label}<select value={f[id]} onChange={set(id)}>{id === "toId" && <option value="">Select…</option>}{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select><Err m={errors[id]} /></label>
  );

  return (
    <Shell title={TITLES[mode]} onClose={onClose} onSubmit={submit} busy={busy} submitText="Save" error={error}>
      <div className="row2">
        <label>Date<input type="date" value={f.date} onChange={set("date")} /><Err m={errors.date} /></label>
        <label>Amount (₹)<input type="number" step="0.01" min="0" value={f.amount} onChange={set("amount")} autoFocus /><Err m={errors.amount} /></label>
      </div>
      {mode === "transfer" ? <><Acc id="fromId" label="From account" /><Acc id="toId" label="To account" /></> : <>
        <Acc id="accountId" label={inc ? "Deposit into account" : "Pay from account"} />
        <label>Payment method<select value={f.method} onChange={set("method")}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
        <label>{inc ? "Link to income record (optional)" : "Link to expense record (optional)"}
          <select value={f.linkId} onChange={onLink}><option value="">None</option>
            {records.map((r) => <option key={r.id} value={r.id}>{r.ref} · {inc ? r.customer : r.vendor} · due {inr(r.amount - r[k])}</option>)}</select>
        </label>
        {rec ? <div className="summary-box"><span>Total <b>{inr(rec.amount)}</b></span><span>Outstanding <b>{inr(link.outstanding)}</b></span></div> : <>
          <label>{inc ? "Receipt type" : "Payment type"}<select value={f.type} onChange={set("type")}>{(inc ? IN_TYPES : OUT_TYPES).map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>{inc ? "Customer (optional)" : "Vendor (optional)"}<input value={f.party} onChange={set("party")} /></label>
          {["Owner capital", "Loan received", "Loan repayment", "Owner drawings", "Account charges"].includes(f.type) && <div className="muted">Not treated as revenue or an ordinary operating expense.</div>}
        </>}
      </>}
      <label>Reference (optional)<input value={f.ref} onChange={set("ref")} /></label>
      <label>Notes (optional)<textarea rows="2" value={f.notes} onChange={set("notes")} /></label>
    </Shell>
  );
}