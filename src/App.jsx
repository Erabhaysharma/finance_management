import { useState } from "react";
import Sidebar, { NAV } from "./components/Sidebar.jsx";
import Dashboard from "./components/Dashboard.jsx";
import IncomePage from "./components/IncomePage.jsx";

export default function App() {
  const [active, setActive] = useState("dashboard");
  const [incomeFormOpen, setIncomeFormOpen] = useState(false);
  const label = NAV.find((n) => n.id === active)?.label;

  const openIncomeForm = () => { setActive("income"); setIncomeFormOpen(true); };

  // Add new pages here one by one.
  const pages = {
    dashboard: <Dashboard onAddIncome={openIncomeForm} />,
    income: <IncomePage formOpen={incomeFormOpen} setFormOpen={setIncomeFormOpen} />,
  };

  return (
    <div className="shell">
      <Sidebar active={active} onSelect={setActive} />
      <main className="main">
        {pages[active] || (
          <div className="placeholder">
            <h1>{label}</h1>
            <p>This page is the next one to build.</p>
          </div>
        )}
      </main>
    </div>
  );
}