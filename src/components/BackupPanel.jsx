import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api } from "../lib/api";
import { api as ledger } from "../accountsService";
import { downloadJson, findDuplicates } from "../reportsLogic";
import "./reports.css";

const when = (iso) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const kb = (b) => (b / 1024).toFixed(1) + " KB";
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

export default function BackupPanel() {
  const [snaps, setSnaps] = useState(null), [dupes, setDupes] = useState(null), [msg, setMsg] = useState(null), [busy, setBusy] = useState(false);
  const say = (text, bad) => setMsg({ text, bad });
  const load = useCallback(() => api("/backups/snapshots").then(setSnaps).catch((e) => { setSnaps([]); say(e.message, true); }), []);
  useEffect(() => {
    load();
    ledger.getAll().then((d) => setDupes({ inc: findDuplicates(d.incomes, "customer"), exp: findDuplicates(d.expenses, "vendor") })).catch(() => setDupes({ inc: [], exp: [] }));
  }, [load]);

  const run = async (fn, ok) => { setBusy(true); setMsg(null); try { await fn(); if (ok) say(ok); } catch (e) { say(e.message, true); } finally { setBusy(false); } };

  return (
    <>
      <div className="warnbox no-print">Backups are read from the database on the server. Download a file regularly and keep it somewhere safe, off this computer. For real disaster recovery turn on Supabase daily backups or point-in-time recovery. To restore, use Supabase's tools or ask your developer: restoring is deliberately not a one-click button.</div>
      {msg && <div className={"auth-msg " + (msg.bad ? "bad" : "good")} role="status" style={{ marginBottom: 12 }}>{msg.text}</div>}
      <section className="card" style={{ marginBottom: 16 }}>
        <h3>Create a backup</h3>
        <p className="muted">Includes accounts and ledger, invoices and bills, notes, users, permissions and settings.</p>
        <div className="controls">
          <button className="btn primary" disabled={busy} onClick={() => run(async () => downloadJson(`finance-backup-${stamp()}.json`, await api("/backups/export")))}><Download size={16} /> Download backup file</button>
          <button className="btn" disabled={busy} onClick={() => run(async () => { await api("/backups/snapshots", { method: "POST" }); await load(); }, "Snapshot saved in the database.")}>Save snapshot in database</button>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h3>Saved snapshots{snaps ? ` (${snaps.length})` : ""}</h3>
        <div className="table-wrap"><table>
          <thead><tr><th>Created</th><th>Type</th><th>Size</th><th className="r">Download</th></tr></thead>
          <tbody>{(snaps || []).map((s) => (
            <tr key={s.id}><td>{when(s.created_at)}</td><td>{s.kind === "auto" ? "Automatic" : "Manual"}</td><td>{kb(s.bytes)}</td>
              <td className="r"><div className="row-actions"><button title="Download" onClick={() => run(async () => downloadJson(`finance-snapshot-${s.created_at.slice(0, 16).replace(/[:T]/g, "-")}.json`, await api(`/backups/snapshots/${s.id}`)))}><Download size={16} /></button></div></td></tr>))}
            {snaps && !snaps.length && <tr><td colSpan="4" className="empty">No snapshots yet.</td></tr>}</tbody>
        </table></div>
      </section>

      <section className="card">
        <h3>Data check: possible duplicates</h3>
        <p className="muted">Entries with the same customer or vendor, amount and date. Review them and delete any that were entered twice.</p>
        {!dupes ? <p className="muted">Checking…</p> : !dupes.inc.length && !dupes.exp.length ? <p className="pos">No duplicates found.</p> : (
          <table><thead><tr><th>Type</th><th>Reference</th><th>Party</th><th>Date</th><th className="r">Amount</th></tr></thead>
            <tbody>{[["Income", dupes.inc, "customer"], ["Expense", dupes.exp, "vendor"]].flatMap(([t, gs, key]) => gs.flat().map((r) => <tr key={t + r.id}><td>{t}</td><td>{r.ref}</td><td>{r[key]}</td><td>{r.date}</td><td className="r">{r.amount}</td></tr>))}</tbody></table>
        )}
      </section>
    </>
  );
}