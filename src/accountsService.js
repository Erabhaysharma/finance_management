// Accounts and ledger, now backed by the FastAPI backend. Same function names the pages already call.
import { api as http, fetchAll } from "./lib/api";
import { mapAccount, mapMove, mapIncome, mapExpense, mapRecon } from "../data/adapters";

export const newKey = () => crypto.randomUUID(); // idempotency key: a retried submit can never post twice
const post = (body) => ({ method: "POST", body });
const str = (n) => String(n);

export const api = {
  async getAll() {
    const [accts, moves, incomes, expenses] = await Promise.all([http("/accounts"), fetchAll("/ledger"), fetchAll("/income"), fetchAll("/expenses")]);
    const names = Object.fromEntries(accts.map((a) => [a.id, a.name]));
    const recons = (await Promise.all(accts.map((a) => http(`/accounts/${a.id}/reconciliations`)))).flat().map(mapRecon);
    return {
      accounts: accts.map(mapAccount), moves: moves.map(mapMove), recons: recons.sort((a, b) => a.savedAt.localeCompare(b.savedAt)),
      incomes: incomes.map((r) => mapIncome(r, names)), expenses: expenses.map((r) => mapExpense(r, names)),
    };
  },

  saveAccount(a) {
    const opening = a.openingBalance != null ? { opening_balance: str(a.openingBalance), opening_date: a.openingDate } : {};
    const common = { name: a.name, type: a.type, identifier_last4: a.identifier || null, notes: a.notes || null };
    if (a.id) return http(`/accounts/${a.id}`, { method: "PATCH", body: { ...common, ...opening, status: a.status } });
    return http("/accounts", post({ ...common, opening_balance: opening.opening_balance ?? null, opening_date: opening.opening_date ?? null }));
  },
  adjust: (d, key) => http("/ledger/adjust", post({ account_id: d.accountId, date: d.date, amount: str(d.amount), reason: d.reason, idempotency_key: key })),
  money: (mode, f, key) => http(mode === "receive" ? "/ledger/receive" : "/ledger/pay", post({
    date: f.date, amount: str(f.amount), account_id: f.accountId, method: f.method, type: f.type, link_id: f.linkId || null,
    party: f.party || null, ref: f.ref || null, notes: f.notes || null, idempotency_key: key })),
  transfer: (f, key) => http("/ledger/transfer", post({ date: f.date, from_id: f.fromId, to_id: f.toId, amount: str(f.amount), ref: f.ref || null, notes: f.notes || null, idempotency_key: key })),
  reverse: (id, reason, key) => http(`/ledger/${id}/reverse`, post({ reason, idempotency_key: key })),
  setRecon: (id, status) => http(`/ledger/${id}/recon`, { method: "PATCH", body: { status } }),
  saveRecon: (r) => http(`/accounts/${r.accountId}/reconciliations`, post({ statement_date: r.statementDate, statement_balance: str(r.statementBalance) })),
};