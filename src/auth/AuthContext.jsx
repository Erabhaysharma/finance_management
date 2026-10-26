import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

function SetupNotice() {
  return (
    <div style={{ maxWidth: 520, margin: "80px auto", padding: 24, fontFamily: "inherit" }}>
      <h2>Connect Supabase first</h2>
      <p>Create a file named <b>.env</b> in the frontend folder (next to package.json) with:</p>
      <pre style={{ background: "#f1f5f9", padding: 12, borderRadius: 8, overflowX: "auto" }}>{`VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co\nVITE_SUPABASE_ANON_KEY=your-anon-public-key`}</pre>
      <p>Both are in Supabase under Project Settings, API. Then stop and restart <b>npm run dev</b>.</p>
    </div>
  );
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false); // true while the user is setting a new password from an email link

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setRecovery(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo(() => {
    const user = session?.user ?? null;
    return {
      session, user, loading, recovery,
      accessToken: session?.access_token ?? null, // send as "Authorization: Bearer ..." to the FastAPI backend
      signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
      signOut: () => supabase.auth.signOut(),
      sendReset: (email) => supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }),
      finishRecovery: async (password) => { const r = await supabase.auth.updateUser({ password }); if (!r.error) setRecovery(false); return r; },
      updateName: (name) => supabase.auth.updateUser({ data: { name } }),
      // Changing email or password first re-checks the current password, so a left-open screen can't be abused.
      async updateEmail(currentPassword, newEmail) {
        const check = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
        if (check.error) return check;
        return supabase.auth.updateUser({ email: newEmail }, { emailRedirectTo: window.location.origin });
      },
      async changePassword(currentPassword, newPassword, signOutOthers) {
        const check = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
        if (check.error) return check;
        const r = await supabase.auth.updateUser({ password: newPassword });
        if (!r.error && signOutOthers) await supabase.auth.signOut({ scope: "others" });
        return r;
      },
      signOutOthers: () => supabase.auth.signOut({ scope: "others" }),
      signOutEverywhere: () => supabase.auth.signOut({ scope: "global" }),
    };
  }, [session, loading, recovery]);

  if (!supabase) return <SetupNotice />;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}