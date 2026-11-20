export type StorySession = { loggedIn: boolean; canReview: boolean };
type Destination = { path: string };

export function followSession({ path }: Destination) {
  window.location.replace(path);
}

export class AccountFormError extends Error {
  constructor(message: string, readonly field?: "name" | "email" | "password") { super(message); }
}

export async function enterAccount(
  { name, email, password }: { name: string; email: string; password: string },
  mode: "signup" | "login", forShare: boolean,
): Promise<Destination> {
  const response = await fetch("/api/session" + (forShare ? "?share=1" : ""), {
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
