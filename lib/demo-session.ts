// These browser values control the welcome animation and tour. The server checks permissions.
const sessionKey = "rye.demo.session";
const pendingKey = "rye.demo.introduction";
const guideKey = (id: string) => "rye.demo.guide." + id;

type Destination = { path: string; topLevel: boolean };

export function followSession({ path, topLevel }: Destination) {
  if (topLevel) window.open(path, "_top");
  else window.location.replace(path);
}

export class AccountFormError extends Error {
  constructor(message: string, readonly field?: "name" | "email" | "password") { super(message); }
}

export async function enterDemo(values: { name: string; email: string; password: string }, signingUp: boolean, forShare: boolean, databaseAccount: boolean) {
  const { name, email, password } = values;
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const id = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  let firstSignup = signingUp;
  if (signingUp && !databaseAccount) {
    try { firstSignup = !localStorage.getItem(guideKey(id)); } catch { /* Storage is optional for onboarding. */ }
  }
  const intent = new URLSearchParams();
  if (forShare) intent.set("share", "1");
  if (firstSignup) intent.set("welcome", "1");
  const mode = signingUp ? "signup" : "login";
  const response = await fetch("/api/demo-session" + (intent.size ? "?" + intent : ""), {
    method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(databaseAccount ? { mode, email, password, name: signingUp ? name : undefined, databaseAccount: true } : signingUp ? { mode } : {
      mode: "login", email: email.trim(), demoPassword: import.meta.env.DEV ? password : undefined,
    }),
  });
  if (!response.ok) {
    const result = await response.json() as { error?: string; field?: "name" | "email" | "password" };
    throw new AccountFormError(result.error || "Login could not be completed. Please try again.", result.field);
  }
  const result: Destination = await response.json();
  try {
    sessionStorage.setItem(sessionKey, id);
    sessionStorage.removeItem(pendingKey);
    if (firstSignup) {
      localStorage.setItem(guideKey(id), "started");
      sessionStorage.setItem(pendingKey, "welcome");
    }
  } catch { /* The server session still works when browser storage is unavailable. */ }
  return result;
}

export function readDemo() {
  try {
    const id = sessionStorage.getItem(sessionKey);
    const pending = id && localStorage.getItem(guideKey(id)) === "started" ? sessionStorage.getItem(pendingKey) : null;
    return { active: Boolean(id), welcome: pending === "welcome", guide: pending === "guide" };
  } catch {
    return { active: false, welcome: false, guide: false };
  }
}

export function startGuide() {
  try { sessionStorage.setItem(pendingKey, "guide"); } catch { /* Continue in this tab. */ }
}

export function finishGuide(outcome: "finished" | "skipped") {
  try {
    const id = sessionStorage.getItem(sessionKey);
    sessionStorage.removeItem(pendingKey);
    if (id) localStorage.setItem(guideKey(id), outcome);
  } catch { /* Finishing the guide does not require browser storage. */ }
}

export async function leaveDemo() {
  const response = await fetch("/api/demo-session", { method: "DELETE", cache: "no-store" });
  if (!response.ok) throw new Error("Log out could not be completed. Please try again.");
  const result: Destination = await response.json();
  try {
    sessionStorage.removeItem(sessionKey);
    sessionStorage.removeItem(pendingKey);
  } catch { /* Logout already revoked the server session. */ }
  return result;
}
