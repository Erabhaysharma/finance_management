import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { api } from "../lib/api";
import { newKey } from "../accountsService";
import { DEFAULT_TYPE } from "../expenseData";

const METHODS = ["Cash", "Bank", "UPI", "Card"];
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");

// One form for income and expenses. `k` is the kind config from RecordsPage.
export default function RecordForm({ k, open, initial, onClose, onSaved, parties, categories, accounts }) {
  const active = accounts.filter((a) => a.status === "active");
  const blank = () => ({ amount: "", date: todayStr(), party: "", category: categories[0] || "", type: "Variable", method: "Bank", accountId: active[0]?.id || "",
    status: k.statuses[0], settled: "", due: "", repeat: false, frequency: "Monthly", ref: "", notes: "" });
  const [f, setF] = useState(blank());
  const [errors, setErrors] = useState({}), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const payKey = useRef(newKey());

  useEffect(() => {
    if (!open) return;
    payKey.current = newKey(); setErrors({}); setError(""); setBusy(false);
    setF(initial ? { ...blank(), amount: String(initial.amount), date: initial.date, party: initial[k.party], category: initial[k.cat], type: initial.type || "Variable", method: initial.method,
      accountId: initial.accountId, due: initial.due, repeat: initial.repeat, frequency: initial.frequency || "Monthly", ref: initial.ref, notes: initial.notes } : blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);
  useEffect(() => { const h = (e) => e.key === "Escape" && onClose(); if (open) window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [open, onClose]);
  if (!open) return null;

  const editing = !!initial;
  const set = (x) => (e) => setF((p) => ({ ...p, [x]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const amount = Number(f.amount) || 0;
  const settled = f.status === k.statuses[0] ? amount : f.status === k.statuses[2] ? 0 : Number(f.settled) || 0;
  const needsDue = !editing && f.status !== k.statuses[0];

  const validate = () => {
    const e = {};
    if (!(amount > 0)) e.amount = "Enter an amount greater than 0";
    if (!f.party.trim()) e.party = `${k.partyLabel} is required`;
    if (!f.category) e.category = "Choose one";
    if (!editing && f.status === k.statuses[1] && !(settled > 0 && settled < amount)) e.settled = "Must be more than 0 and less than the total";
    if (!editing && settled > 0 && !f.accountId) e.accountId = "Choose the account the money went through";
    if (needsDue && !f.due) e.due = "Due date is required";
    return e;
  };

  const payload = (allowDup) => ({
    date: f.date, [k.party]: f.party.trim(), [k.cat]: f.category, ...(k.hasType ? { expense_type: f.type } : {}), method: f.method,
    account_id: f.accountId || null, amount: String(amount), due_date: f.due || null, repeat: f.repeat, frequency: f.repeat ? f.frequency : null,
    notes: f.notes || null, ...(editing ? {} : { ref: f.ref || null, allow_duplicate: allowDup }),
  });

  async function submit(ev) {
    ev.preventDefault();
    const e = validate(); setErrors(e); setError("");
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (editing) { await api(`${k.path}/${initial.id}`, { method: "PATCH", body: payload(false) }); return onSaved("Saved."); }
      let rec;
      try { rec = await api(k.path, { method: "POST", body: payload(false) }); }
      catch (x) {
        if (!/already exists/i.test(x.message) || !window.confirm(`${x.message.split(" Resend")[0]}\n\nAdd it anyway?`)) throw x;
        rec = await api(k.path, { method: "POST", body: payload(true) });
      }
      if (settled > 0) {
        try { await api(k.pay, { method: "POST", body: { date: f.date, amount: String(settled), account_id: f.accountId, method: f.method, link_id: rec.id, idempotency_key: payKey.current } }); }
        catch (x) { return onSaved(`Saved, but the payment was not recorded: ${x.message} Use Record payment on the row to try again.`, true); }
      }
      onSaved("Saved.");
    } catch (x) { setError(x.message); setBusy(false); }
  }
  const Err = ({ x }) => (errors[x] ? <span className="err">{errors[x]}</span> : null);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="drawer" onSubmit={submit} noValidate role="dialog" aria-label={editing ? `Edit ${k.noun}` : k.add}>
        <header className="drawer-head"><h2>{editing ? `Edit ${k.noun}` : k.add}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></header>
        <div className="drawer-body">
          <div className="row2">
            <label>Amount (₹)<input type="number" min="0" step="0.01" value={f.amount} onChange={set("amount")} autoFocus placeholder="0.00" /><Err x="amount" /></label>
            <label>Date<input type="date" value={f.date} onChange={set("date")} /></label>
          </div>
          <label>{k.partyLabel}<input list="parties" value={f.party} onChange={set("party")} placeholder="Select or type" /><datalist id="parties">{parties.map((p) => <option key={p} value={p} />)}</datalist><Err x="party" /></label>
          <div className="row2">
            <label>{k.catLabel}<select value={f.category} onChange={(e) => setF((p) => ({ ...p, category: e.target.value, type: DEFAULT_TYPE[e.target.value] || p.type }))}>{categories.map((c) => <option key={c}>{c}</option>)}</select><Err x="category" /></label>
            {k.hasType ? <label>Expense type<select value={f.type} onChange={set("type")}><option>Fixed</option><option>Variable</option></select></label>
              : <label>Payment method<select value={f.method} onChange={set("method")}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>}
          </div>
          {k.hasType && <label>Payment method<select value={f.method} onChange={set("method")}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>}

          {!editing && <>
            <label>Payment status<select value={f.status} onChange={set("status")}>{k.statuses.map((s) => <option key={s}>{s}</option>)}</select></label>
            {f.status === k.statuses[1] && <label>Amount {k.doneWord} so far (₹)<input type="number" min="0" step="0.01" value={f.settled} onChange={set("settled")} /><Err x="settled" /></label>}
            {settled > 0 && <label>{k.accountLabel}<select value={f.accountId} onChange={set("accountId")}><option value="">Select account…</option>{active.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select><Err x="accountId" /></label>}
            {needsDue && <label>Due date<input type="date" value={f.due} onChange={set("due")} /><Err x="due" /></label>}
            {amount > 0 && <div className="summary-box"><span>{k.doneCap} <b>{inr(settled)}</b></span><span>Balance <b>{inr(Math.max(amount - settled, 0))}</b></span></div>}
          </>}
          {editing && <label>Due date<input type="date" value={f.due} onChange={set("due")} /></label>}
          {editing && <p className="muted">To change what has been {k.doneWord}, use Record payment on the row. Payments always go through an account.</p>}

          <label className="check"><input type="checkbox" checked={f.repeat} onChange={set("repeat")} /> Repeats</label>
          {f.repeat && <label>Frequency<select value={f.frequency} onChange={set("frequency")}>{["Weekly", "Monthly", "Yearly"].map((x) => <option key={x}>{x}</option>)}</select></label>}
          {!editing && <label>Reference (optional)<input value={f.ref} onChange={set("ref")} placeholder="Leave blank to auto-generate" /></label>}
          <label>Notes (optional)<textarea rows="2" value={f.notes} onChange={set("notes")} /></label>
          {error && <div className="dup" role="alert">{error}</div>}
        </div>
        <footer className="drawer-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : `Save ${k.noun}`}</button></footer>
      </form>
    </div>
  );
}