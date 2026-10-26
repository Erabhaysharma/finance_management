import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { friendlyAuthError, passwordIssues } from "../auth/authHelpers";
import { PasswordField, Checklist } from "./PasswordField";
import "./auth.css";

const Msg = ({ m }) => (m ? <div className={"auth-msg " + (m.bad ? "bad" : "good")} role={m.bad ? "alert" : "status"}>{m.text}</div> : null);

function useForm() {
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(null);
  const run = async (fn) => {
    setBusy(true); setMsg(null);
    try { setMsg(await fn()); } catch (x) { setMsg({ bad: true, text: friendlyAuthError(x) }); }
    finally { setBusy(false); }
  };
  return { busy, msg, run, setMsg };
}
const result = (error, ok) => (error ? { bad: true, text: friendlyAuthError(error) } : { text: ok });

function NameCard({ user, updateName }) {
  const [name, setName] = useState(user.user_metadata?.name || "");
  const f = useForm();
  return (
    <form className="card acct-card-form" onSubmit={(e) => { e.preventDefault(); f.run(async () => !name.trim() ? { bad: true, text: "Enter your name." } : result((await updateName(name.trim())).error, "Name saved.")); }}>
      <h3>Profile</h3>
      <label>Display name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
      <Msg m={f.msg} /><div><button className="btn primary" disabled={f.busy}>Save name</button></div>
    </form>
  );
}

function EmailCard({ user, updateEmail }) {
  const [email, setEmail] = useState(""), [pw, setPw] = useState("");
  const f = useForm();
  const submit = (e) => {
    e.preventDefault();
    f.run(async () => {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return { bad: true, text: "Enter a valid new email address." };
      if (email.trim().toLowerCase() === user.email.toLowerCase()) return { bad: true, text: "That is already your email." };
      if (!pw) return { bad: true, text: "Enter your current password to confirm." };
      const { error } = await updateEmail(pw, email.trim());
      if (!error) { setPw(""); setEmail(""); }
      return result(error, `We sent a confirmation link to ${email.trim()}. Your sign-in email changes after you open it. You may also get a link at your current address.`);
    });
  };
  return (
    <form className="card acct-card-form" onSubmit={submit}>
      <h3>Email address</h3>
      <p className="muted">Current: <b>{user.email}</b></p>
      <label>New email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
      <PasswordField id="em-pw" label="Current password" value={pw} onChange={setPw} autoComplete="current-password" />
      <Msg m={f.msg} /><div><button className="btn primary" disabled={f.busy}>Change email</button></div>
    </form>
  );
}

function PasswordCard({ changePassword }) {
  const [cur, setCur] = useState(""), [pw, setPw] = useState(""), [pw2, setPw2] = useState(""), [others, setOthers] = useState(true);
  const f = useForm();
  const submit = (e) => {
    e.preventDefault();
    f.run(async () => {
      if (!cur) return { bad: true, text: "Enter your current password." };
      const issues = passwordIssues(pw);
      if (issues.length) return { bad: true, text: "Your new password needs " + issues.join(", ") + "." };
      if (pw !== pw2) return { bad: true, text: "The two new passwords don't match." };
      if (pw === cur) return { bad: true, text: "The new password must be different from your current one." };
      const { error } = await changePassword(cur, pw, others);
      if (!error) { setCur(""); setPw(""); setPw2(""); }
      return result(error, others ? "Password changed. Other devices were signed out." : "Password changed.");
    });
  };
  return (
    <form className="card acct-card-form" onSubmit={submit}>
      <h3>Password</h3>
      <PasswordField id="cp-cur" label="Current password" value={cur} onChange={setCur} autoComplete="current-password" />
      <PasswordField id="cp-new" label="New password" value={pw} onChange={setPw} autoComplete="new-password" />
      <Checklist password={pw} />
      <PasswordField id="cp-new2" label="Confirm new password" value={pw2} onChange={setPw2} autoComplete="new-password" />
      <label className="check-row"><input type="checkbox" checked={others} onChange={(e) => setOthers(e.target.checked)} /> Sign out my other devices after changing</label>
      <Msg m={f.msg} /><div><button className="btn primary" disabled={f.busy}>Change password</button></div>
    </form>
  );
}

function SessionsCard({ signOutEverywhere }) {
  const f = useForm();
  return (
    <section className="card acct-card-form">
      <h3>Sessions</h3>
      <p className="muted">Lost a device or shared your login? Sign out everywhere, including this device. You will need to sign in again.</p>
      <Msg m={f.msg} />
      <div><button className="btn" disabled={f.busy} onClick={() => window.confirm("Sign out of all devices?") && f.run(async () => result((await signOutEverywhere()).error, ""))}><LogOut size={16} /> Sign out of all devices</button></div>
    </section>
  );
}

export default function AccountPage() {
  const a = useAuth();
  if (!a.user) return null;
  return (
    <>
      <header className="topbar"><div><h1>My account</h1><p className="sub">Update your name, sign-in email and password.</p></div></header>
      <div className="acct-grid2">
        <NameCard user={a.user} updateName={a.updateName} />
        <EmailCard user={a.user} updateEmail={a.updateEmail} />
        <PasswordCard changePassword={a.changePassword} />
        <SessionsCard signOutEverywhere={a.signOutEverywhere} />
      </div>
    </>
  );
}