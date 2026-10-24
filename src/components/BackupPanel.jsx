import { useEffect, useState } from "react";
import { Download, Upload, Trash2, RotateCcw } from "lucide-react";
import { collect, validate, summary, applyBackup, listSnapshots, saveSnapshot, deleteSnapshot, autoEnabled, setAutoEnabled, autoSnapshotIfDue } from "../backupStore";
import { downloadJson, findDuplicates } from "../reportsLogic";
import { api } from "../accountsService";
import "./reports.css";

const when = (iso) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const kb = (b) => (b / 1024).toFixed(1) + " KB";
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

function RestoreDialog({ backup, onClose }) {
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const s = summary(backup);
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try { downloadJson(`safety-backup-before-restore-${stamp()}.json`, await collect()); await applyBackup(backup); }
    catch (x) { setError(x.message); setBusy(false); }
  };
  return (
    <div className="overlay center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog" onSubmit={go} style={{ width: 440 }}>
        <h3>Restore this backup?</h3>
        <p className="sub">Created {when(s.createdAt)}</p>
        <div className="bk-sum"><span>Accounts <b>{s.accounts}</b></span><span>Account movements <b>{s.movements}</b></span><span>Invoices <b>{s.invoices}</b></span><span>Bills <b>{s.bills}</b></span><span>Notes <b>{s.notes}</b></span><span>Users <b>{s.users}</b></span></div>
        <div className="warnbox">This replaces your current accounts, notes and admin data. A safety backup of the current data downloads first, so you can undo this. The page then reloads.</div>
        <label>Type RESTORE to confirm<input value={text} onChange={(e) => setText(e.target.value)} autoFocus /></label>
        {error && <span className="err">{error}</span>}
        <div className="dialog-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={text !== "RESTORE" || busy}>{busy ? "Restoring…" : "Restore"}</button></div>
      </form>
    </div>
  );
}

export default function BackupPanel() {
  const [snaps, setSnaps] = useState(listSnapshots());
  const [auto, setAuto] = useState(autoEnabled());
  const [pending, setPending] = useState(null);
  const [fileError, setFileError] = useState("");
  const [dupes, setDupes] = useState(null);
  const refresh = () => setSnaps(listSnapshots());

  useEffect(() => { autoSnapshotIfDue().then(refresh); api.getAll().then((d) => setDupes({ inc: findDuplicates(d.incomes, "customer"), exp: findDuplicates(d.expenses, "vendor") })); }, []);

  const onFile = async (e) => {
    const file = e.target.files[0]; e.target.value = ""; setFileError("");
    if (!file) return;
    try { const b = JSON.parse(await file.text()); const err = validate(b); err ? setFileError(err) : setPending(b); }
    catch { setFileError("This file could not be read. Choose a backup file made by this app."); }
  };

  return (
    <>
      <div className="warnbox no-print">Backups here are kept in this browser and as files you download. Store the downloaded files somewhere safe, off this computer. Scheduled server-side backups need the Supabase backend. Restoring should be limited to the Owner once sign-in exists.</div>
      <div className="bk-grid">
        <section className="card">
          <h3>Create a backup</h3>
          <p className="muted">Includes accounts and ledger, invoices and bills, notes, users, permissions and settings.</p>
          <div className="controls">
            <button className="btn primary" onClick={async () => downloadJson(`finance-backup-${stamp()}.json`, await collect())}><Download size={16} /> Download backup file</button>
            <button className="btn" onClick={async () => { await saveSnapshot("Manual"); refresh(); }}>Save snapshot in browser</button>
          </div>
          <label className="check" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14, fontSize: 14 }}>
            <input type="checkbox" checked={auto} onChange={(e) => { setAutoEnabled(e.target.checked); setAuto(e.target.checked); }} /> Take one automatic snapshot per day when the app is opened
          </label>
        </section>
        <section className="card">
          <h3>Restore from a file</h3>
          <p className="muted">Choose a backup file. You will see what it contains before anything changes.</p>
          <label className="btn" style={{ display: "inline-flex", gap: 6, cursor: "pointer" }}><Upload size={16} /> Choose backup file<input type="file" accept="application/json,.json" onChange={onFile} hidden /></label>
          {fileError && <p className="err" role="alert">{fileError}</p>}
        </section>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <h3>Saved snapshots ({snaps.length}, newest 10 kept)</h3>
        <div className="table-wrap"><table>
          <thead><tr><th>Created</th><th>Type</th><th>Size</th><th className="r">Actions</th></tr></thead>
          <tbody>{snaps.map((s) => (
            <tr key={s.id}><td>{when(s.createdAt)}</td><td>{s.source}</td><td>{kb(s.bytes)}</td>
              <td className="r"><div className="row-actions">
                <button title="Download" onClick={() => downloadJson(`finance-backup-${s.createdAt.slice(0, 16).replace(/[:T]/g, "-")}.json`, s.backup)}><Download size={16} /></button>
                <button title="Restore" onClick={() => setPending(s.backup)}><RotateCcw size={16} /></button>
                <button title="Delete snapshot" className="danger" onClick={() => window.confirm("Delete this snapshot?") && (deleteSnapshot(s.id), refresh())}><Trash2 size={16} /></button>
              </div></td></tr>))}
            {!snaps.length && <tr><td colSpan="4" className="empty">No snapshots yet.</td></tr>}</tbody>
        </table></div>
      </section>

      <section className="card">
        <h3>Data check: possible duplicates</h3>
        <p className="muted">Entries with the same customer or vendor, amount and date. Review them and delete or reverse any that were entered twice.</p>
        {!dupes ? <p className="muted">Checking…</p> : !dupes.inc.length && !dupes.exp.length ? <p className="pos">No duplicates found.</p> : (
          <table><thead><tr><th>Type</th><th>Reference</th><th>Party</th><th>Date</th><th className="r">Amount</th></tr></thead>
            <tbody>{[["Income", dupes.inc, "customer"], ["Expense", dupes.exp, "vendor"]].flatMap(([t, gs, k]) => gs.flat().map((r) => <tr key={t + r.id}><td>{t}</td><td>{r.ref}</td><td>{r[k]}</td><td>{r.date}</td><td className="r">{r.amount}</td></tr>))}</tbody></table>
        )}
      </section>
      {pending && <RestoreDialog backup={pending} onClose={() => setPending(null)} />}
    </>
  );
}