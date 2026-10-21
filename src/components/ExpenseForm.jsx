import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CATEGORIES, LIMITS, METHODS, ACCOUNTS, STATUSES, TYPES, DEFAULT_TYPE, today } from "../expenseData";

const blank = () => ({
  amount: "", date: today(), category: "Rent", type: "Fixed", vendor: "",
  method: "Cash", account: ACCOUNTS[0], status: "Paid", paid: "", due: "",
  repeat: false, frequency: "Monthly", endDate: "", ref: "", notes: "", file: "",
});

export default function ExpenseForm({ open, onClose, onSave, vendors, existing, initial }) {
  const [f, setF] = useState(blank());
  const [errors, setErrors] = useState({});
  const [dupConfirmed, setDupConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setF(initial ? { ...blank(), ...initial, amount: String(initial.amount), paid: String(initial.paid) } : blank());
      setErrors({});
      setDupConfirmed(false);
    }
  }, [open, initial]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setF((p) => ({ ...p, [k]: v }));
    setDupConfirmed(false);
  };
  const onCategory = (e) => {
    const category = e.target.value;
    setF((p) => ({ ...p, category, type: DEFAULT_TYPE[category] }));
  };

  const amount = Number(f.amount) || 0;
  const paid = f.status === "Paid" ? amount : f.status === "Unpaid" ? 0 : Number(f.paid) || 0;
  const balance = Math.max(amount - paid, 0);
  const needsAccount = f.method !== "Cash";
  const needsDue = f.status !== "Paid";

  // Spending limit check for the chosen category and month.
  const monthKey = f.date.slice(0, 7);
  const spentBefore = existing
    .filter((x) => x.id !== initial?.id && x.category === f.category && x.date.slice(0, 7) === monthKey)
    .reduce((s, x) => s + x.amount, 0);
  const limit = LIMITS[f.category];
  const overLimit = amount > 0 && spentBefore + amount > limit;

  const isDuplicate = existing.some(
    (x) => x.id !== initial?.id && x.vendor.toLowerCase() === f.vendor.trim().toLowerCase() && x.amount === amount && x.date === f.date
  );

  const validate = () => {
    const e = {};
    if (!(amount > 0)) e.amount = "Enter an amount greater than 0";
    if (!f.vendor.trim()) e.vendor = "Vendor / payee name is required";
    if (f.status === "Partially paid" && !(paid > 0 && paid < amount))
      e.paid = "Must be more than 0 and less than the total";
    if (needsDue && !f.due) e.due = "Due date is required";
    return e;
  };

  const submit = (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    if (isDuplicate && !dupConfirmed) { setDupConfirmed(true); return; }
    onSave({
      ...f,
      vendor: f.vendor.trim(),
      amount,
      paid,
      account: needsAccount ? f.account : "",
      due: needsDue ? f.due : "",
    });
  };

  const Err = ({ k }) => (errors[k] ? <span className="err">{errors[k]}</span> : null);
  const inr = (n) => "₹" + n.toLocaleString("en-IN");

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="drawer" onSubmit={submit} noValidate role="dialog" aria-label={initial ? "Edit expense" : "Add expense"}>
        <header className="drawer-head">
          <h2>{initial ? "Edit expense" : "Add expense"}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>

        <div className="drawer-body">
          <div className="row2">
            <label>Amount (₹)
              <input type="number" min="0" step="0.01" value={f.amount} onChange={set("amount")} autoFocus placeholder="0.00" />
              <Err k="amount" />
            </label>
            <label>Date
              <input type="date" value={f.date} onChange={set("date")} />
            </label>
          </div>

          <div className="row2">
            <label>Category
              <select value={f.category} onChange={onCategory}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <label>Expense type
              <select value={f.type} onChange={set("type")}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
          </div>

          <label>Vendor / payee
            <input list="vendors" value={f.vendor} onChange={set("vendor")} placeholder="Select or type a vendor" />
            <datalist id="vendors">{vendors.map((v) => <option key={v} value={v} />)}</datalist>
            <Err k="vendor" />
          </label>

          <label>Payment method
            <select value={f.method} onChange={set("method")}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
          </label>

          {needsAccount && (
            <label>Paid from account
              <select value={f.account} onChange={set("account")}>{ACCOUNTS.map((a) => <option key={a}>{a}</option>)}</select>
            </label>
          )}

          <label>Payment status
            <select value={f.status} onChange={set("status")}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </label>

          {f.status === "Partially paid" && (
            <label>Amount paid so far (₹)
              <input type="number" min="0" step="0.01" value={f.paid} onChange={set("paid")} />
              <Err k="paid" />
            </label>
          )}

          {needsDue && (
            <label>Due date
              <input type="date" value={f.due} onChange={set("due")} />
              <Err k="due" />
            </label>
          )}

          {amount > 0 && (
            <div className="summary-box">
              <span>Paid <b>{inr(paid)}</b></span>
              <span>Balance to pay <b>{inr(balance)}</b></span>
            </div>
          )}

          {overLimit && (
            <div className="dup">
              This will take {f.category} to {inr(spentBefore + amount)} this month, above its limit of {inr(limit)}.
            </div>
          )}

          <label className="check">
            <input type="checkbox" checked={f.repeat} onChange={set("repeat")} /> Repeat this expense
          </label>
          {f.repeat && (
            <div className="row2">
              <label>Frequency
                <select value={f.frequency} onChange={set("frequency")}>
                  {["Weekly", "Monthly", "Yearly"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </label>
              <label>Ends on (optional)
                <input type="date" value={f.endDate} onChange={set("endDate")} />
              </label>
            </div>
          )}

          <label>Bill / reference no. (optional)
            <input value={f.ref} onChange={set("ref")} placeholder="Leave blank to auto-generate" />
          </label>
          <label>Notes (optional)
            <textarea rows="2" value={f.notes} onChange={set("notes")} />
          </label>
          <label>Bill / receipt (optional)
            <input type="file" accept="image/*,.pdf" onChange={(e) => setF((p) => ({ ...p, file: e.target.files[0]?.name || "" }))} />
          </label>

          {isDuplicate && (
            <div className="dup">
              An expense with the same vendor, amount and date already exists.
              {dupConfirmed ? " Press Save again to add it anyway." : ""}
            </div>
          )}
        </div>

        <footer className="drawer-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">{initial ? "Save changes" : "Save expense"}</button>
        </footer>
      </form>
    </div>
  );
}