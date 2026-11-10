import {
  LayoutDashboard, TrendingUp, TrendingDown, BarChart3, Wallet,
  StickyNote, ShieldCheck, FileText, Bot
} from "lucide-react";
import UserMenu from "./UserMenu.jsx";
import { useMe } from "../../data/session.js";

export const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "income", label: "Income", icon: TrendingUp },
  { id: "expenses", label: "Expenses", icon: TrendingDown },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "accounts", label: "Cash & accounts", icon: Wallet },
  { id: "notes", label: "Notes & reminders", icon: StickyNote },
  { id: "admin", label: "Admin & access", icon: ShieldCheck },
  { id: "assistant", label: "Arth Saarthi", icon: Bot },
  { id: "reports", label: "Reports & backups", icon: FileText },
];

export default function Sidebar({ active, onSelect }) {
  const { me, error, retry } = useMe();
  // Shows only the pages this role can view. The server enforces the same rule on every request.
  const allowed = (id) => me && (me.role === "owner" || me.permissions?.[id]?.view);
  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">₹</span><span>A4 Finance Flow</span></div>
      <nav>
        {error && (
          <div style={{ padding: 12, margin: "4px 0", background: "rgba(255,255,255,.08)", borderRadius: 10, fontSize: 13, color: "#fecaca" }} role="alert">
            Can't load your account: {error}
            <div><button className="btn" style={{ marginTop: 8 }} onClick={retry}>Try again</button></div>
          </div>
        )}
        {NAV.filter((n) => allowed(n.id)).map(({ id, label, icon: Icon }) => (
          <button key={id} className={"nav-item" + (active === id ? " active" : "")} onClick={() => onSelect(id)}>
            <Icon size={18} /><span>{label}</span>
          </button>
        ))}
      </nav>
      <UserMenu active={active} onSelect={onSelect} />
    </aside>
  );
}