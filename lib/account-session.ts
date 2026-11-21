export type StorySession = { loggedIn: boolean; canReview: boolean };
type Destination = { path: string };
export type AccountIntent = { next: "share" } | { next: "connections"; story?: string } | null;

export function readAccountIntent(query: URLSearchParams): AccountIntent {
  const next = query.get("next");
  if (next === "share") return { next };
  if (next !== "connections") return null;
  const story = query.get("story");
  return { next, story: story && /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(story) ? story : undefined };
}

export function followSession({ path }: Destination) {
  window.location.replace(path);
}

export class AccountFormError extends Error {
  constructor(message: string, readonly field?: "name" | "email" | "password") { super(message); }
}

export async function enterAccount(
  { name, email, password }: { name: string; email: string; password: string },
  mode: "signup" | "login", intent: AccountIntent,
): Promise<Destination> {
  const params = new URLSearchParams();
  if (intent) params.set(intent.next, "1");
  if (intent?.next === "connections" && intent.story) params.set("story", intent.story);
  const response = await fetch("/api/session" + (intent ? "?" + params : ""), {
    method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, email, password, name: mode === "signup" ? name : undefined }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: string; field?: AccountFormError["field"] } | null;
    throw new AccountFormError(result?.error || "Sign-in could not be completed. Please try again.", result?.field);
  }
  return response.json();
}

export async function logOutAccount(): Promise<Destination> {
  const response = await fetch("/api/session", { method: "DELETE", cache: "no-store" });
  if (!response.ok) throw new Error("Log out could not be completed. Please try again.");
  return response.json();
}
