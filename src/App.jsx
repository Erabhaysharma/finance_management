import { useState } from "react";
import Sidebar, { NAV } from "./components/Sidebar.jsx";
import Dashboard from "./components/Dashboard.jsx";
import IncomePage from "./components/IncomePage.jsx";
import ExpensePage from "./components/ExpensePage.jsx";
import AnalyticsPage from "./components/AnalyticsPage.jsx";
import AccountsPage from "./components/AccountsPage.jsx";
import NotesPage from "./components/NotesPage.jsx";
import ReminderAlerts from "./components/ReminderAlerts.jsx";
import AdminPage from "./components/AdminPage.jsx";
import ReportsPage from "./components/ReportsPage.jsx";
import AccountPage from "./components/AccountPage.jsx";
import SignInPage from "./components/SignInPage.jsx";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";

function MainApp() {
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
    analytics: <AnalyticsPage />,
    accounts: <AccountsPage onNavigate={setActive} />,
    notes: <NotesPage />,
    admin: <AdminPage />,
    reports: <ReportsPage />,
    account: <AccountPage />,
  };

  return (
    <div className="shell">
      <Sidebar active={active} onSelect={setActive} />
      <main className="main">
        {active === "dashboard" && <ReminderAlerts onOpen={() => setActive("notes")} />}
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

// Shows the sign-in page until the user is signed in. Also shows it while a password reset link is being used.
function Gate() {
  const { loading, session, recovery } = useAuth();
  if (loading) return <div className="state-box" role="status">Loading…</div>;
  return session && !recovery ? <MainApp /> : <SignInPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}