import { supabase } from "./supabase";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Calls the FastAPI backend with the signed-in user's token. Throws Error(message) on any failure.
export async function api(path, { method = "GET", body } = {}) {
  const { data } = await supabase.auth.getSession(); // refreshes the token when needed
  const token = data.session?.access_token;
  if (!token) throw new Error("You are signed out. Please sign in again.");
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Can't reach the server. Is the backend running?");
  }
  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const d = json?.detail;
    throw new Error(typeof d === "string" ? d : d?.[0]?.msg || `Request failed (${res.status})`);
  }
  return json;
}

// Lists are paged by the server (max 200 per page). This reads every page.
export async function fetchAll(path, params = "") {
  const out = [];
  let page = 1, total = 0;
  do {
    const r = await api(`${path}?${params}${params ? "&" : ""}page=${page}&size=200`);
    out.push(...r.items);
    total = r.total;
    page += 1;
  } while (out.length < total && page < 500);
  return out;
}