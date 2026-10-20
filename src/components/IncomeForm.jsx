import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { SOURCES, METHODS, ACCOUNTS, STATUSES, today } from "../incomeData";

const blank = () => ({
  amount: "", date: today(), source: "Sales", customer: "", method: "Cash",
  status: "Received", received: "", due: "", account: ACCOUNTS[0],
  repeat: false, frequency: "Monthly", endDate: "", ref: "", notes: "", file: "",
});

export default function IncomeForm({ open, onClose, onSave, customers, existing }) {
  const [f, setF] = useState(blank());
  const [errors, setErrors] = useState({});
  const [dupConfirmed, setDupConfirmed] = useState(false);

  useEffect(() => {
    if (open) { setF(blank()); setErrors({}); setDupConfirmed(false); }
  }, [open]);

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

  const amount = Number(f.amount) || 0;
  const received = f.status === "Received" ? amount : f.status === "Pending" ? 0 : Number(f.received) || 0;
  const balance = Math.max(amount - received, 0);
  const needsAccount = f.method === "Bank" || f.method === "UPI" || f.method === "Card";
  const needsDue = f.status !== "Received";

  const isDuplicate = existing.some(
    (x) => x.customer.toLowerCase() === f.customer.trim().toLowerCase() && x.amount === amount && x.date === f.date
  );

  const validate = () => {
    const e = {};
    if (!(amount > 0)) e.amount = "Enter an amount greater than 0";
    if (!f.customer.trim()) e.customer = "Customer name is required";
    if (f.status === "Partially received" && !(received > 0 && received < amount))
      e.received = "Must be more than 0 and less than the total";
    if (needsDue && !f.due) e.due = "Due date is required";
    if (f.repeat && !f.frequency) e.frequency = "Pick how often it repeats";
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
      customer: f.customer.trim(),
      amount,
      received,
      account: needsAccount ? f.account : "",
      due: needsDue ? f.due : "",
      repeat: f.repeat,
    });
  };

  const Err = ({ k }) => (errors[k] ? <span className="err">{errors[k]}</span> : null);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="drawer" onSubmit={submit} noValidate role="dialog" aria-label="Add income">
        <header className="drawer-head">
          <h2>Add income</h2>
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

          <label>Customer name
            <input list="customers" value={f.customer} onChange={set("customer")} placeholder="Select or type a new customer" />
            <datalist id="customers">{customers.map((c) => <option key={c} value={c} />)}</datalist>
            <Err k="customer" />
          </label>

          <div className="row2">
            <label>Income source
              <select value={f.source} onChange={set("source")}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
            </label>
            <label>Payment method
              <select value={f.method} onChange={set("method")}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
            </label>
          </div>

          {needsAccount && (
            <label>Deposited into account
              <select value={f.account} onChange={set("account")}>{ACCOUNTS.map((a) => <option key={a}>{a}</option>)}</select>
            </label>
          )}

          <label>Payment status
            <select value={f.status} onChange={set("status")}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </label>

          {f.status === "Partially received" && (
            <label>Amount received so far (₹)
              <input type="number" min="0" step="0.01" value={f.received} onChange={set("received")} />
              <Err k="received" />
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
              <span>Received <b>₹{received.toLocaleString("en-IN")}</b></span>
              <span>Balance due <b>₹{balance.toLocaleString("en-IN")}</b></span>
            </div>
          )}

          <label className="check">
            <input type="checkbox" checked={f.repeat} onChange={set("repeat")} /> Repeat this income
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

          <label>Invoice / reference no. (optional)
            <input value={f.ref} onChange={set("ref")} placeholder="Leave blank to auto-generate" />
          </label>
          <label>Notes (optional)
            <textarea rows="2" value={f.notes} onChange={set("notes")} />
          </label>
          <label>Attachment (optional)
            <input type="file" accept="image/*,.pdf" onChange={(e) => setF((p) => ({ ...p, file: e.target.files[0]?.name || "" }))} />
          </label>

          {isDuplicate && (
            <div className="dup">
              An entry with the same customer, amount and date already exists.
              {dupConfirmed ? " Press Save again to add it anyway." : ""}
            </div>
          )}
        </div>

        <footer className="drawer-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Save income</button>
        </footer>
      </form>
    </div>
  );
}