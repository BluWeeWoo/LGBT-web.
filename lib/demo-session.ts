// These values drive the frontend demo only. Story permissions come from the server.
const sessionKey = "rye.demo.session";
const pendingKey = "rye.demo.introduction";
const guideKey = (id: string) => "rye.demo.guide." + id;

type Destination = { path: string; topLevel: boolean };

export function followSession({ path, topLevel }: Destination) {
  if (topLevel) window.open(path, "_top");
  else window.location.replace(path);
}

export async function enterDemo(email: string, signingUp: boolean, forShare: boolean) {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const id = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  const firstSignup = signingUp && !localStorage.getItem(guideKey(id));
  const intent = new URLSearchParams();
  if (forShare) intent.set("share", "1");
  if (firstSignup) intent.set("welcome", "1");
  // Only navigation intent travels to the server. Email and password stay in the form.
  const response = await fetch("/api/demo-session" + (intent.size ? "?" + intent : ""), { method: "POST", cache: "no-store" });
  if (!response.ok) throw new Error("Login could not be completed. Please try again.");
  const result: Destination = await response.json();
  sessionStorage.setItem(sessionKey, id);
  sessionStorage.removeItem(pendingKey);
  if (firstSignup) {
    localStorage.setItem(guideKey(id), "started");
    sessionStorage.setItem(pendingKey, "welcome");
  }
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
  sessionStorage.setItem(pendingKey, "guide");
}

export function finishGuide(outcome: "finished" | "skipped") {
  const id = sessionStorage.getItem(sessionKey);
  sessionStorage.removeItem(pendingKey);
  if (id) localStorage.setItem(guideKey(id), outcome);
}

export async function leaveDemo() {
  const response = await fetch("/api/demo-session", { method: "DELETE", cache: "no-store" });
  if (!response.ok) throw new Error("Log out could not be completed. Please try again.");
  const result: Destination = await response.json();
  sessionStorage.removeItem(sessionKey);
  sessionStorage.removeItem(pendingKey);
  return result;
}
