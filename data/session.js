import { useCallback, useEffect, useState } from "react";
import { api } from "../src/lib/api";

// Account names and category lists for dropdowns.
export function useLookups() {
  const [d, setD] = useState({ accounts: [], sources: [], categories: [], business: null });
  useEffect(() => {
    let on = true;
    api("/lookups").then((x) => on && setD(x)).catch(() => {});
    return () => { on = false; };
  }, []);
  return d;
}

// Role and permissions of the signed-in user. Also returns the error (so the sidebar can explain a failure) and a retry function.
export function useMe() {
  const [state, setState] = useState({ me: null, error: "" });
  const load = useCallback(() => {
    setState({ me: null, error: "" });
    api("/me").then((me) => setState({ me, error: "" })).catch((e) => setState({ me: null, error: e.message }));
  }, []);
  useEffect(() => { load(); }, [load]);
  return { ...state, retry: load };
}