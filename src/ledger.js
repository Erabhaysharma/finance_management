// Pure ledger helpers. Balances come from account movements, never from invoice/bill records.
export const r2 = (n) => Math.round(Number(n) * 100) / 100;
export const ACCOUNT_TYPES = ["Bank", "Cash", "Wallet/UPI", "Other"];
export const IN_TYPES = ["Customer payment", "Other receipt", "Owner capital", "Loan received"];
export const OUT_TYPES = ["Expense payment", "Loan repayment", "Owner drawings", "Account charges", "Other payment"];
export const METHODS = ["Cash", "Bank", "UPI", "Card"];
export const RECON = ["Unmatched", "Matched", "Needs review"];

export const settleStatus = (kind, amount, settled) =>
  kind === "income" ? (settled >= amount ? "Received" : settled > 0 ? "Partially received" : "Pending")
                    : (settled >= amount ? "Paid" : settled > 0 ? "Partially paid" : "Unpaid");

export const isLive = (m) => !m.reversedBy && !m.reversalOf;                       // not reversed, not a reversal
export const countsAsFlow = (m) => isLive(m) && !m.transferId && m.type !== "Adjustment"; // real money received/paid
export const inRange = (d, [f, t]) => (!f || d >= f) && (!t || d <= t);

export function summarizeAccount(acct, moves, range) {
  const mine = moves.filter((m) => m.accountId === acct.id);
  const net = mine.reduce((s, m) => s + m.in - m.out, 0); // reversals net to zero here
  const live = mine.filter((m) => isLive(m) && inRange(m.date, range));
  return {
    balance: acct.openingBalance == null ? null : r2(acct.openingBalance + net),
    in: r2(live.reduce((s, m) => s + m.in, 0)), out: r2(live.reduce((s, m) => s + m.out, 0)),
    last: mine.map((m) => m.date).sort().at(-1) || "", count: mine.length,
  };
}

export function runningBalances(acct, moves) {
  const out = {}; let bal = acct.openingBalance ?? 0;
  moves.filter((m) => m.accountId === acct.id).sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq)
    .forEach((m) => { bal = r2(bal + m.in - m.out); out[m.id] = { value: bal, relative: acct.openingBalance == null }; });
  return out;
}

export const bookBalanceAt = (acct, moves, date) =>
  acct.openingBalance == null ? null
    : r2(acct.openingBalance + moves.filter((m) => m.accountId === acct.id && m.date <= date).reduce((s, m) => s + m.in - m.out, 0));

// Shared by the forms and the service (a backend must repeat these checks).
export function validateMoney(mode, f, ctx = {}) {
  const e = {}, amt = Number(f.amount);
  if (!f.date) e.date = "Date is required";
  if (!Number.isFinite(amt) || amt <= 0) e.amount = "Enter an amount greater than 0";
  else if (Math.abs(amt * 100 - Math.round(amt * 100)) > 1e-6) e.amount = "Use at most 2 decimal places";
  else if (ctx.link && amt > ctx.link.outstanding + 0.004) e.amount = `Exceeds the outstanding balance of ${ctx.link.outstanding}`;
  if (mode === "transfer") {
    if (!f.fromId) e.fromId = "Choose the source account";
    if (!f.toId) e.toId = "Choose the destination account";
    else if (f.fromId === f.toId) e.toId = "Source and destination must differ";
  } else if (!ctx.account) e.accountId = "Choose an account";
  else if (ctx.account.status === "archived") e.accountId = "Archived accounts cannot take new transactions";
  else if (ctx.account.openingDate && f.date < ctx.account.openingDate) e.date = "Date is before the account's opening date";
  return e;
}