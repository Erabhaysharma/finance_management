import { createClient } from "@supabase/supabase-js";
import { detectLinkType } from "../auth/authHelpers";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY; // the public "anon" key. Never put the service_role key in the frontend.

// Read BEFORE the client starts: Supabase removes the #token part of the address after it uses it.
// "invite" = a new user opening their invitation, "recovery" = a password reset link.
export const LINK_TYPE = detectLinkType(window.location.hash);

export const supabase = url && key ? createClient(url, key) : null;