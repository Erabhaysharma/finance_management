// Pure report calculations and CSV helpers. No React.
import { inRange, r2, summarizeAccount } from "./ledger";

export function plReport(incomes, expenses, range, basis) {
  const cash = basis === "cash";
  const inR = incomes.filter((r) => inRange(r.date, range)), exR = expenses.filter((r) => inRange(r.date, range));
  const group = (rows, key, val) => { const m = {}; rows.forEach((r) => { m[r[key]] = r2((m[r[key]] || 0) + val(r)); }); return m; };
  const income = group(inR, "source", (r) => (cash ? r.received : r.amount));
  const expense = group(exR, "category", (r) => (cash ? r.paid : r.amount));
  const ev = (r) => (cash ? r.paid : r.amount);
  const revenue = r2(Object.values(income).reduce((a, b) => a + b, 0)), costs = r2(Object.values(expense).reduce((a, b) => a + b, 0));
  return {
    income, expense, revenue, costs, net: r2(revenue - costs), margin: revenue ? ((revenue - costs) / revenue) * 100 : null,
    fixed: r2(exR.filter((r) => r.type === "Fixed").reduce((s, r) => s + ev(r), 0)), variable: r2(exR.filter((r) => r.type === "Variable").reduce((s, r) => s + ev(r), 0)),
  };
}

// Every movement that touched the account, with running balance from the opening of the period.
export function statement(acct, moves, [from, to]) {
  const mine = moves.filter((m) => m.accountId === acct.id).sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq);
  const before = mine.filter((m) => from && m.date < from).reduce((s, m) => s + m.in - m.out, 0);
  const known = acct.openingBalance != null;
  let bal = (known ? acct.openingBalance : 0) + before;
  const opening = known ? r2(bal) : null;
  const lines = mine.filter((m) => inRange(m.date, [from, to])).map((m) => { bal = r2(bal + m.in - m.out); return { ...m, running: bal }; });
  const totalIn = r2(lines.reduce((s, l) => s + l.in, 0)), totalOut = r2(lines.reduce((s, l) => s + l.out, 0));
  return { opening, lines, totalIn, totalOut, closing: known ? r2(opening + totalIn - totalOut) : null, net: r2(totalIn - totalOut) };
}

// Simplified management balance sheet, as of today. Not a statutory statement.
export function balanceSheet(accounts, moves, incomes, expenses) {
  const rows = accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, balance: summarizeAccount(a, moves, ["", ""]).balance }));
  const cashRows = rows.filter((r) => r.balance != null), missing = rows.filter((r) => r.balance == null).map((r) => r.name);
  const cash = r2(cashRows.reduce((s, r) => s + r.balance, 0));
  const recv = r2(incomes.reduce((s, r) => s + Math.max(r.amount - r.received, 0), 0)), pay = r2(expenses.reduce((s, r) => s + Math.max(r.amount - r.paid, 0), 0));
  return { cashRows, missing, cash, recv, pay, assets: r2(cash + recv), net: r2(cash + recv - pay) };
}

export function findDuplicates(records, partyKey) {
  const m = {};
  records.forEach((r) => { const k = `${String(r[partyKey]).trim().toLowerCase()}|${r.amount}|${r.date}`; (m[k] ||= []).push(r); });
  return Object.values(m).filter((g) => g.length > 1);
}

const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
// UTF-8 BOM so Excel shows ₹ and other characters correctly. Raw numbers are kept unformatted.
export function downloadCsv(name, rows) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
export function downloadJson(name, obj) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}