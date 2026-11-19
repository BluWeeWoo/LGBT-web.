import { env } from "cloudflare:workers";
import { isReviewLogin } from "./story-access";

// The development identity provider always verifies the same loopback test user.
export const localReviewer = "seedy@sites.test";

export function isLocalReviewerLogin(email: string) {
  return import.meta.env.DEV && (email === localReviewer ||
    (Boolean(email) && email === env.RYE_LOCAL_REVIEWER_EMAIL?.trim().toLowerCase()));
}

export function isReviewerEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return (import.meta.env.DEV && normalized === localReviewer) ||
    (env.RYE_ADMIN_EMAILS ?? "").split(",").some(entry => entry.trim().toLowerCase() === normalized);
}

export function reviewerId(headers: Pick<Headers, "get">) {
  const id = headers.get("oai-authenticated-user-id");
  const verifiedEmail = headers.get("oai-authenticated-user-email");
  if (!isReviewLogin(headers) || !id || !verifiedEmail || !isReviewerEmail(verifiedEmail)) return null;
  return id;
}
