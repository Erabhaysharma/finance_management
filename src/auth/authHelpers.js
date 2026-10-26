// Pure helpers. Supabase enforces its own password rules too (Authentication > Policies); these give instant feedback.
export const RULES = [
  ["at least 10 characters", (p) => p.length >= 10],
  ["a letter", (p) => /[A-Za-z]/.test(p)],
  ["a number", (p) => /\d/.test(p)],
];
export const passwordIssues = (pw) => RULES.filter(([, ok]) => !ok(pw)).map(([label]) => label);

export function friendlyAuthError(e) {
  const m = (e?.message || "").toLowerCase();
  if (m.includes("invalid login")) return "Email or password is incorrect.";
  if (m.includes("not confirmed")) return "This email isn't confirmed yet. Check your inbox for the confirmation link.";
  if (e?.status === 429 || m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("same password") || m.includes("different from the old")) return "The new password must be different from your current one.";
  if (m.includes("fetch") || m.includes("network")) return "Can't reach the server. Check your internet connection.";
  if (m.includes("weak") || m.includes("password should")) return "That password is too weak. Use a longer one with letters and numbers.";
  return e?.message || "Something went wrong. Please try again.";
}