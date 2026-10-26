import { useState } from "react";
import { Mail, ShieldCheck, BarChart3, Wallet } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { friendlyAuthError, passwordIssues } from "../auth/authHelpers";
import { PasswordField, Checklist } from "./PasswordField";
import "./auth.css";

const BRAND = "A4 Finance Flow";
const TITLES = { signin: ["Welcome back", "Sign in to manage your business finances."], forgot: ["Reset your password", "Enter your email and we will send you a reset link."], newpass: ["Choose a new password", "Pick a strong password you have not used before."] };

export default function SignInPage() {
  const { recovery, signIn, sendReset, finishRecovery } = useAuth();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const view = recovery ? "newpass" : mode;
  const go = (m) => { setMode(m); setError(""); setInfo(""); setPw(""); setPw2(""); };

  async function submit(e) {
    e.preventDefault(); setError(""); setInfo("");
    if (view !== "newpass" && !/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (view === "signin" && !pw) return setError("Enter your password.");
    if (view === "newpass") {
      const issues = passwordIssues(pw);
      if (issues.length) return setError("Your password needs " + issues.join(", ") + ".");
      if (pw !== pw2) return setError("The two passwords don't match.");
    }
    setBusy(true);
    try {
      if (view === "signin") { const { error: err } = await signIn(email.trim(), pw); if (err) setError(friendlyAuthError(err)); }
      else if (view === "forgot") {
        const { error: err } = await sendReset(email.trim());
        if (err?.status === 429) setError(friendlyAuthError(err));
        else setInfo("If an account exists for this email, a reset link is on its way. Check your inbox and spam folder."); // same message either way
      } else { const { error: err } = await finishRecovery(pw); if (err) setError(friendlyAuthError(err)); }
    } catch (x) { setError(friendlyAuthError(x)); }
    finally { setBusy(false); }
  }

  const [title, sub] = TITLES[view];
  return (
    <div className="auth-shell">
      <aside className="auth-hero">
        <div className="auth-brand"><span className="brand-mark">₹</span><span>{BRAND}</span></div>
        <h2>Know where your money stands, every day.</h2>
        <ul>
          <li><BarChart3 size={18} /> Income, expenses and profit at a glance</li>
          <li><Wallet size={18} /> Cash, bank and UPI balances that reconcile</li>
          <li><ShieldCheck size={18} /> Role-based access with a full change history</li>
        </ul>
      </aside>

      <main className="auth-panel">
        <form className="auth-card" onSubmit={submit} noValidate>
          <div className="auth-brand dark"><span className="brand-mark">₹</span><span>{BRAND}</span></div>
          <h1>{title}</h1>
          <p className="sub">{sub}</p>

          {view !== "newpass" && (
            <label htmlFor="email">Email
              <span className="pw-wrap"><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus placeholder="you@company.com" /><Mail size={18} className="pw-icon" /></span>
            </label>
          )}
          {view === "signin" && <PasswordField id="password" label="Password" value={pw} onChange={setPw} autoComplete="current-password" />}
          {view === "newpass" && <>
            <PasswordField id="np" label="New password" value={pw} onChange={setPw} autoComplete="new-password" autoFocus />
            <Checklist password={pw} />
            <PasswordField id="np2" label="Confirm new password" value={pw2} onChange={setPw2} autoComplete="new-password" />
          </>}

          {error && <div className="auth-msg bad" role="alert">{error}</div>}
          {info && <div className="auth-msg good" role="status">{info}</div>}

          <button className="btn primary auth-submit" disabled={busy}>
            {busy ? "Please wait…" : view === "signin" ? "Sign in" : view === "forgot" ? "Send reset link" : "Save new password"}
          </button>

          {view === "signin" && <button type="button" className="auth-link" onClick={() => go("forgot")}>Forgot your password?</button>}
          {view === "forgot" && <button type="button" className="auth-link" onClick={() => go("signin")}>Back to sign in</button>}
          {view === "signin" && <p className="auth-foot">Access is by invitation only. Ask your administrator if you need an account.</p>}
        </form>
      </main>
    </div>
  );
}