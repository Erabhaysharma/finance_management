// Pure calculation helpers for the Analytics page. No React, no side effects.
export const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format;
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => new Date(s + "T00:00:00");
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
export const todayStr = () => ymd(new Date());
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);

export const PERIODS = ["Today", "This week", "This month", "Last 30 days", "This year", "Custom"];
export function rangeFor(period, from, to) {
  const t = todayStr();
  if (period === "Today") return [t, t];
  if (period === "This week") return [addDays(t, -((parse(t).getDay() + 6) % 7)), t];
  if (period === "This month") return [t.slice(0, 8) + "01", t];
  if (period === "This year") return [t.slice(0, 4) + "-01-01", t];
  if (period === "Custom") return [from || t, to || t];
  return [addDays(t, -29), t];
}
// Previous period = same number of days immediately before the current range.
export function previousRange([f, t]) { const n = daysBetween(f, t) + 1; return [addDays(f, -n), addDays(f, -1)]; }

// One common row shape for income and expense records.
export function normalize(incomes, expenses) {
  const t = todayStr();
  const mk = (r, kind) => {
    const inc = kind === "income";
    const settled = inc ? r.received : r.paid;
    const open = Math.max(r.amount - settled, 0); // negative balances are NOT counted as receivable/payable
    return {
      kind, id: kind[0] + r.id, ref: r.ref, date: r.date, party: inc ? r.customer : r.vendor,
      category: inc ? r.source : r.category, type: inc ? "" : r.type, method: r.method, account: r.account || "",
      state: open === 0 ? "Settled" : settled > 0 ? "Partial" : "Unsettled",
      amount: r.amount, settled, open, due: r.due || "", overdue: open > 0 && !!r.due && r.due < t, notes: r.notes || "",
    };
  };
  return [...incomes.map((r) => mk(r, "income")), ...expenses.map((r) => mk(r, "expense"))];
}

// Source filter only limits income rows; category and expense-type filters only limit expense rows.
export function applyFilters(rows, f, [from, to]) {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) =>
    r.date >= from && r.date <= to &&
    (f.kind === "All" || r.kind === f.kind.toLowerCase()) &&
    (!f.account || (f.account === "__cash" ? !r.account : r.account === f.account)) &&
    (!f.method || r.method === f.method) &&
    (!f.state || (f.state === "Overdue" ? r.overdue : r.state === f.state)) &&
    (!f.source || r.kind !== "income" || r.category === f.source) &&
    (!f.category || r.kind !== "expense" || r.category === f.category) &&
    (!f.etype || r.kind !== "expense" || r.type === f.etype) &&
    (!q || `${r.ref} ${r.party} ${r.category} ${r.notes}`.toLowerCase().includes(q)));
}

export function summarize(rows) {
  const s = { income: 0, expense: 0, received: 0, paid: 0, recv: 0, pay: 0 };
  rows.forEach((r) => {
    if (r.kind === "income") { s.income += r.amount; s.received += r.settled; s.recv += r.open; }
    else { s.expense += r.amount; s.paid += r.settled; s.pay += r.open; }
  });
  s.net = s.income - s.expense;
  s.netCash = s.received - s.paid;
  return s;
}

export function groupSum(rows, kind, key = "category") {
  const m = {};
  rows.filter((r) => r.kind === kind).forEach((r) => { m[r[key]] = (m[r[key]] || 0) + r.amount; });
  const tot = Object.values(m).reduce((a, b) => a + b, 0);
  return Object.entries(m).map(([name, value]) => ({ name, value, pct: tot ? (value / tot) * 100 : 0 })).sort((a, b) => b.value - a.value);
}

const bucketKey = (d, i) => (i === "day" ? d : i === "month" ? d.slice(0, 7) : addDays(d, -((parse(d).getDay() + 6) % 7)));
export function trend(rows, interval) {
  const m = {};
  rows.forEach((r) => {
    const k = bucketKey(r.date, interval);
    const b = (m[k] ||= { key: k, income: 0, expense: 0, received: 0, paid: 0 });
    if (r.kind === "income") { b.income += r.amount; b.received += r.settled; } else { b.expense += r.amount; b.paid += r.settled; }
  });
  let cum = 0;
  return Object.values(m).sort((a, b) => a.key.localeCompare(b.key)).map((b) => {
    cum += b.received - b.paid;
    return { ...b, net: b.income - b.expense, cash: b.received - b.paid, cum };
  });
}

// Utilisation of monthly limits for one month (YYYY-MM), using only the filtered rows.
export function budget(rows, limits, month) {
  return Object.keys(limits).map((name) => {
    const used = rows.filter((r) => r.kind === "expense" && r.category === name && r.date.slice(0, 7) === month).reduce((s, r) => s + r.amount, 0);
    return { name, used, limit: limits[name], pct: (used / limits[name]) * 100 };
  });
}

// Ageing uses the DUE date, measured against today.
export function ageing(rows) {
  const t = todayStr();
  const B = ["Not due", "1–30 days", "31–60 days", "61+ days"].map((name) => ({ name, receivable: 0, payable: 0 }));
  rows.filter((r) => r.open > 0).forEach((r) => {
    const late = r.due ? daysBetween(r.due, t) : 0;
    B[late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : 3][r.kind === "income" ? "receivable" : "payable"] += r.open;
  });
  return B;
}

export function insights(cur, prev, rows, bud, cats, compare) {
  if (!rows.length) return [];
  const out = [];
  out.push(cur.net < 0
    ? { level: "danger", text: `Recorded expenses exceed recorded income by ${inr(-cur.net)} in this period.` }
    : { level: "good", text: `Recorded income exceeds expenses by ${inr(cur.net)} in this period.` });
  if (cur.netCash < 0) out.push({ level: "warn", text: `Cash paid (${inr(cur.paid)}) is higher than cash received (${inr(cur.received)}).` });
  const od = (k) => rows.filter((r) => r.kind === k && r.overdue).reduce((s, r) => s + r.open, 0);
  if (od("income")) out.push({ level: "warn", text: `${inr(od("income"))} of receivables is overdue.` });
  if (od("expense")) out.push({ level: "warn", text: `${inr(od("expense"))} of payables is overdue.` });
  bud.filter((b) => b.pct >= 80).forEach((b) => out.push({ level: b.pct > 100 ? "danger" : "warn", text: `${b.name} has used ${Math.round(b.pct)}% of its monthly limit.` }));
  if (cats[0] && cats[0].pct > 40) out.push({ level: "info", text: `${cats[0].name} is ${Math.round(cats[0].pct)}% of all expenses.` });
  if (compare && prev.income > 0) {
    const c = ((cur.income - prev.income) / prev.income) * 100;
    out.push({ level: c >= 0 ? "good" : "warn", text: `Income is ${c >= 0 ? "up" : "down"} ${Math.abs(c).toFixed(1)}% versus the previous period.` });
  }
  return out;
}