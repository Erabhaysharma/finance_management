// Mock repository. Every export below maps to a future FastAPI endpoint.
// Writes take an idempotency `key`, so a repeated submit is a no-op. Validation is repeated here as a server would.
import { seedIncomes } from "./incomeData";
import { seedExpenses } from "./expenseData";
import { r2, settleStatus, validateMoney, isLive } from "./ledger";
import { todayStr } from "./analytics";

const clone = (x) => JSON.parse(JSON.stringify(x));
let n = 0;
const nid = (p) => `${p}_${Date.now().toString(36)}${(++n).toString(36)}`;
export const newKey = () => nid("k");
const acct = (id, name, type) => ({ id, name, type, openingBalance: null, openingDate: "", currency: "INR", identifier: "", notes: "", status: "active" });
const mv = (b) => ({ id: nid("m"), seq: ++n, in: 0, out: 0, recon: "Unmatched", transferId: "", reversalOf: "", reversedBy: "", party: "", notes: "", link: null, ...b });

const db = {
  accounts: [acct("a_hdfc", "HDFC Current A/c", "Bank"), acct("a_sbi", "SBI Savings A/c", "Bank"), acct("a_upi", "Business UPI", "Wallet/UPI"), acct("a_cash", "Cash in Hand", "Cash")],
  moves: [], incomes: clone(seedIncomes), expenses: clone(seedExpenses), recons: [], done: new Map(),
};
const byName = { "HDFC Current A/c": "a_hdfc", "SBI Savings A/c": "a_sbi", "Business UPI": "a_upi" };
const accFor = (r) => byName[r.account] || "a_cash";
// Seed movements = only the settled part of the sample records. Opening balances are deliberately NOT invented.
db.incomes.filter((r) => r.received > 0).forEach((r) => db.moves.push(mv({ date: r.date, ref: r.ref, desc: `Payment from ${r.customer}`, type: "Customer payment", accountId: accFor(r), method: r.method, in: r.received, party: r.customer, link: { kind: "income", id: r.id } })));
db.expenses.filter((r) => r.paid > 0).forEach((r) => db.moves.push(mv({ date: r.date, ref: r.ref, desc: `Payment to ${r.vendor}`, type: "Expense payment", accountId: accFor(r), method: r.method, out: r.paid, party: r.vendor, link: { kind: "expense", id: r.id } })));

const get = (list, id) => list.find((x) => String(x.id) === String(id));
const once = (key, fn) => {
  if (key && db.done.has(key)) return Promise.resolve(db.done.get(key));
  try { const out = fn(); if (key) db.done.set(key, out); return Promise.resolve(out); } catch (e) { return Promise.reject(e); }
};
const fail = (e) => { const m = Object.values(e)[0]; if (m) throw new Error(m); };

export const api = {
    restore: (s) => once(null, () => { ["accounts", "moves", "incomes", "expenses", "recons"].forEach((k) => { db[k] = JSON.parse(JSON.stringify(s[k])); }); return true; }),
  getAll: () => Promise.resolve(clone({ accounts: db.accounts, moves: db.moves, incomes: db.incomes, expenses: db.expenses, recons: db.recons })),

  saveAccount: (a, key) => once(key, () => {
    const name = (a.name || "").trim();
    if (!name) throw new Error("Account name is required");
    if (db.accounts.some((x) => x.id !== a.id && x.name.toLowerCase() === name.toLowerCase())) throw new Error("An account with this name already exists");
    if (a.openingBalance != null && (!Number.isFinite(a.openingBalance) || !a.openingDate)) throw new Error("Opening balance needs a valid amount and date");
    const cur = a.id && get(db.accounts, a.id);
    if (!cur) { db.accounts.push({ ...a, name, id: nid("a") }); return true; }
    if (cur.openingBalance != null) a = { ...a, openingBalance: cur.openingBalance, openingDate: cur.openingDate }; // changes only via adjust()
    Object.assign(cur, a, { name }); // accounts are archived, never deleted; id stays stable
    return true;
  }),

  adjust: ({ accountId, amount, date, reason }, key) => once(key, () => {
    const v = r2(amount);
    if (!v || !date || !(reason || "").trim()) throw new Error("Amount, date and reason are required");
    db.moves.push(mv({ date, ref: "ADJ", desc: `Balance adjustment: ${reason.trim()}`, type: "Adjustment", accountId, method: "Bank", in: v > 0 ? v : 0, out: v < 0 ? -v : 0 }));
    return true;
  }),

  // mode: "receive" | "pay". Linked payments update the invoice/bill and never create a duplicate record.
  money: (mode, f, key) => once(key, () => {
    const inc = mode === "receive", k = inc ? "received" : "paid";
    const account = get(db.accounts, f.accountId), rec = f.linkId ? get(inc ? db.incomes : db.expenses, f.linkId) : null;
    fail(validateMoney(mode, f, { account, link: rec && { outstanding: r2(rec.amount - rec[k]) } }));
    const amt = r2(f.amount);
    if (rec) { rec[k] = r2(rec[k] + amt); rec.status = settleStatus(inc ? "income" : "expense", rec.amount, rec[k]); }
    db.moves.push(mv({
      date: f.date, ref: f.ref || (rec ? rec.ref : "—"), accountId: f.accountId, method: f.method, notes: f.notes || "", party: f.party || "",
      type: rec ? (inc ? "Customer payment" : "Expense payment") : f.type,
      desc: rec ? `${inc ? "Payment from" : "Payment to"} ${inc ? rec.customer : rec.vendor}` : f.party || f.type,
      in: inc ? amt : 0, out: inc ? 0 : amt, link: rec ? { kind: inc ? "income" : "expense", id: rec.id } : null,
    }));
    return true;
  }),

  transfer: (f, key) => once(key, () => {
    const from = get(db.accounts, f.fromId), to = get(db.accounts, f.toId);
    fail(validateMoney("transfer", f));
    if (!from || !to || from.status === "archived" || to.status === "archived") throw new Error("Both accounts must be active");
    const amt = r2(f.amount), ref = f.ref || "TRF";
    if (db.moves.some((m) => isLive(m) && m.transferId && m.type === "Transfer out" && m.accountId === from.id && m.date === f.date && m.out === amt && m.ref === ref && m.desc.endsWith(to.name))) throw new Error("This transfer looks like a duplicate");
    const t = nid("t"), base = { date: f.date, ref, method: "Bank", transferId: t, notes: f.notes || "" };
    db.moves.push(mv({ ...base, accountId: from.id, out: amt, type: "Transfer out", desc: `Transfer to ${to.name}` }), mv({ ...base, accountId: to.id, in: amt, type: "Transfer in", desc: `Transfer from ${from.name}` }));
    return true;
  }),

  // Posted entries are never deleted: a reversal movement is added and the linked record is rolled back.
  reverse: (id, reason, key) => once(key, () => {
    const m = get(db.moves, id);
    if (!m || !isLive(m)) throw new Error("Only live entries can be reversed");
    if (!(reason || "").trim()) throw new Error("A reason is required");
    const group = m.transferId ? db.moves.filter((x) => x.transferId === m.transferId && isLive(x)) : [m];
    group.forEach((g) => {
      const rev = mv({ date: todayStr(), ref: g.ref, desc: `Reversal of ${g.ref}: ${reason.trim()}`, type: "Reversal", accountId: g.accountId, method: g.method, in: g.out, out: g.in, reversalOf: g.id });
      g.reversedBy = rev.id; db.moves.push(rev);
      if (g.link) {
        const inc = g.link.kind === "income", rec = get(inc ? db.incomes : db.expenses, g.link.id), k = inc ? "received" : "paid";
        rec[k] = r2(Math.max(rec[k] - (g.in || g.out), 0)); rec.status = settleStatus(g.link.kind, rec.amount, rec[k]);
      }
    });
    return true;
  }),

  setRecon: (id, status) => once(null, () => { get(db.moves, id).recon = status; return true; }),

  saveRecon: (r, key) => once(key, () => {
    db.recons.push({ ...r, id: nid("r"), status: r.diff === 0 && r.unresolved === 0 ? "Reconciled" : "Discrepancy", savedAt: new Date().toISOString() });
    return true;
  }),
  // Extension point: importStatement(accountId, csvRows) -> candidate rows to match. Not implemented, no bank connection.
};