import { AlertTriangle, Check } from "lucide-react";
import { useNotes, notesApi, noteState, PRIORITY_WEIGHT } from "../notesStore";
import "./notes.css";

const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");

// Shows only when something is overdue or due today. Place it at the top of the Dashboard.
export default function ReminderAlerts({ onOpen }) {
  const notes = useNotes();
  const items = notes
    .map((n) => ({ n, s: noteState(n) }))
    .filter((x) => x.s.key === "overdue" || x.s.key === "today")
    .sort((a, b) => (a.s.key === b.s.key ? 0 : a.s.key === "overdue" ? -1 : 1) || PRIORITY_WEIGHT[a.n.priority] - PRIORITY_WEIGHT[b.n.priority] || b.s.days - a.s.days);
  if (!items.length) return null;

  const overdue = items.filter((x) => x.s.key === "overdue").length;
  const shown = items.slice(0, 5);
  return (
    <section className={"reminder" + (overdue ? "" : " warn")} role="alert">
      <div className="reminder-head">
        <AlertTriangle size={20} color={overdue ? "#b91c1c" : "#d97706"} />
        <b>{overdue ? `${overdue} overdue` : ""}{overdue && items.length > overdue ? " · " : ""}{items.length > overdue ? `${items.length - overdue} due today` : ""}</b>
        <button className="btn" onClick={onOpen}>Open notes</button>
      </div>
      <ul>
        {shown.map(({ n, s }) => (
          <li key={n.id}>
            <span className={"badge " + n.priority.toLowerCase()}>{n.priority}</span>
            <span className={"badge " + n.type.toLowerCase().replace(" ", "-")}>{n.type}</span>
            <span className="grow"><b>{n.title}</b>{n.party && ` · ${n.party}`}{n.amount !== "" && n.amount != null && ` · ${inr(n.amount)}`}</span>
            <span className={s.key === "overdue" ? "st-overdue" : "st-today"}>{s.label}</span>
            <button className="btn" onClick={() => notesApi.setDone(n.id, true)} aria-label={`Mark ${n.title} done`}><Check size={14} /> Done</button>
          </li>
        ))}
      </ul>
      {items.length > shown.length && <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>+{items.length - shown.length} more in Notes</p>}
    </section>
  );
}