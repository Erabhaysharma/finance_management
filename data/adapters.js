// Converts backend rows (snake_case, uuid ids) into the shapes the pages already use.
export const num = (v) => (v == null ? 0 : Number(v));

export const mapAccount = (a) => ({
  id: a.id, name: a.name, type: a.type, status: a.status, currency: "INR", notes: a.notes || "", identifier: a.identifier_last4 || "",
  openingBalance: a.opening_balance == null ? null : num(a.opening_balance), openingDate: a.opening_date || "",
});
export const mapMove = (m) => ({
  id: m.id, seq: num(m.seq), date: m.date, ref: m.ref, desc: m.description, type: m.type, accountId: m.account_id, method: m.method,
  in: num(m.money_in), out: num(m.money_out), link: m.link_id ? { kind: m.link_kind, id: m.link_id } : null,
  transferId: m.transfer_id || "", reversalOf: m.reversal_of || "", reversedBy: m.reversed_by || "", recon: m.recon_status, party: m.party || "", notes: m.notes || "",
});
export const mapIncome = (r, names = {}) => ({
  id: r.id, ref: r.ref, date: r.date, customer: r.customer, source: r.source, method: r.method, accountId: r.account_id || "", account: names[r.account_id] || "",
  status: r.status, amount: num(r.amount), received: num(r.received), due: r.due_date || "", repeat: !!r.repeat, frequency: r.frequency || "", notes: r.notes || "",
});
export const mapExpense = (r, names = {}) => ({
  id: r.id, ref: r.ref, date: r.date, vendor: r.vendor, category: r.category, type: r.expense_type, method: r.method, accountId: r.account_id || "", account: names[r.account_id] || "",
  status: r.status, amount: num(r.amount), paid: num(r.paid), due: r.due_date || "", repeat: !!r.repeat, frequency: r.frequency || "", notes: r.notes || "",
});
export const mapRecon = (r) => ({
  id: r.id, accountId: r.account_id, statementDate: r.statement_date, statementBalance: num(r.statement_balance), bookBalance: num(r.book_balance),
  diff: num(r.diff), unresolved: r.unresolved, status: r.status, savedAt: r.created_at,
});