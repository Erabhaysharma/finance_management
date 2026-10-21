import { useState } from "react";
import Sidebar, { NAV } from "./components/Sidebar.jsx";
import Dashboard from "./components/Dashboard.jsx";
import IncomePage from "./components/IncomePage.jsx";
import ExpensePage from "./components/ExpensePage.jsx";

export default function App() {
  const [active, setActive] = useState("dashboard");
  const [incomeFormOpen, setIncomeFormOpen] = useState(false);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const label = NAV.find((n) => n.id === active)?.label;

  const openIncomeForm = () => { setActive("income"); setIncomeFormOpen(true); };
  const openExpenseForm = () => { setActive("expenses"); setExpenseFormOpen(true); };

  // Add new pages here one by one.
  const pages = {
    dashboard: <Dashboard onAddIncome={openIncomeForm} onAddExpense={openExpenseForm} />,
    income: <IncomePage formOpen={incomeFormOpen} setFormOpen={setIncomeFormOpen} />,
    expenses: <ExpensePage formOpen={expenseFormOpen} setFormOpen={setExpenseFormOpen} />,
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