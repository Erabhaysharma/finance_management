import {
  LayoutDashboard, TrendingUp, TrendingDown, BarChart3, Wallet,
  Target, ShieldCheck, FileText,
} from "lucide-react";

export const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "income", label: "Income", icon: TrendingUp },
  { id: "expenses", label: "Expenses", icon: TrendingDown },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "accounts", label: "Cash & accounts", icon: Wallet },
  { id: "planning", label: "Planning", icon: Target, phase2: true },
  { id: "admin", label: "Admin & access", icon: ShieldCheck },
  { id: "reports", label: "Reports & backups", icon: FileText },
];

export default function Sidebar({ active, onSelect }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">₹</span>
        <span>A4 Finance Flow</span>
      </div>
      <nav>
        {NAV.map(({ id, label, icon: Icon, phase2 }) => (
          <button
            key={id}
            className={"nav-item" + (active === id ? " active" : "")}
            onClick={() => onSelect(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
            {phase2 && <em className="tag">Phase 2</em>}
          </button>
        ))}
      </nav>
    </aside>
  );
}
