import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY; // the public "anon" key. Never put the service_role key in the frontend.

export const supabase = url && key ? createClient(url, key) : null;