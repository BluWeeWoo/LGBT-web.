import { chatGPTSignInPath, chatGPTSignOutPath } from "../../chatgpt-auth";
import { demoCookie, storySession } from "../../../lib/story-access";
import { isLocalReviewerLogin, isReviewerEmail, localReviewer, reviewerId } from "../../../lib/admin-access";
import { mysqlAction, mysqlEnabled, mysqlFailure, mysqlSession, mysqlSessionCookie } from "../../../lib/mysql";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  if (mysqlEnabled()) {
    try { return Response.json(await mysqlSession(request.headers), { headers: noStore }); }
    catch (error) { return mysqlFailure(error); }
  }
  return Response.json({ ...storySession(request.headers), canReview: Boolean(reviewerId(request.headers)) }, { headers: noStore });
}

async function update(request: Request, loggedIn: boolean) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if ((origin && origin !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ error: "Use the login form on RYE." }, { status: 403, headers: noStore });
  }
  const secure = url.protocol === "https:" ? "; Secure" : "";
  if (mysqlEnabled()) {
    try {
      const cookieOptions = "; Path=/; HttpOnly; SameSite=Lax" + secure;
      if (!loggedIn) {
        await mysqlAction(request.headers, "logout");
        return Response.json({ path: "/login", topLevel: false }, { headers: {
          ...noStore, "Set-Cookie": mysqlSessionCookie + "=; Max-Age=0" + cookieOptions,
        } });
      }
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return Response.json({ error: "Use the log in form." }, { status: 415, headers: noStore });
      const input = await request.json<{ mode?: string; email?: string; name?: string; password?: string; databaseAccount?: boolean }>().catch(() => null);
      if (!input?.databaseAccount || (input.mode !== "signup" && input.mode !== "login"))
        return Response.json({ error: "Reload the page and enter your account details." }, { status: 400, headers: noStore });
      const session = await mysqlAction<{ token: string; canReview: boolean }>(request.headers, "authenticate", {
        mode: input.mode, email: input.email, name: input.name, password: input.password,
        client: request.headers.get("cf-connecting-ip") || "local",
      });
      const intent = new URLSearchParams();
      if (url.searchParams.get("share") === "1") intent.set("share", "1");
      if (input.mode === "signup") intent.set("welcome", "1");
      const path = session.canReview ? "/admin" : intent.size ? "/?" + intent : "/";
      return Response.json({ path, topLevel: false }, { headers: {
        ...noStore, "Set-Cookie": mysqlSessionCookie + "=" + session.token + "; Max-Age=604800" + cookieOptions,
      } });
    } catch (error) { return mysqlFailure(error); }
  }
  let reviewerLogin = false;
  if (loggedIn && request.headers.get("content-type")?.startsWith("application/json")) {
    const data = await request.json<{ mode?: unknown; email?: unknown; demoPassword?: unknown; databaseAccount?: boolean }>().catch(() => null);
    const email = typeof data?.email === "string" ? data.email.trim().toLowerCase() : "";
    if (!data || data.databaseAccount || (data.mode !== "signup" && data.mode !== "login") ||
        (data.mode === "login" && (!email || email.length > 254))) {
      return Response.json({ error: "Check your login details and try again." }, { status: 400, headers: noStore });
    }
    const localLogin = data.mode === "login" && isLocalReviewerLogin(email);
    reviewerLogin = localLogin || (data.mode === "login" && isReviewerEmail(email));
    if (localLogin && data.demoPassword !== "AtlasReview!26") {
      return Response.json({ error: "Check your reviewer email and password." }, { status: 401, headers: noStore });
    }
    const verifiedEmail = request.headers.get("oai-authenticated-user-email");
    if (reviewerLogin && verifiedEmail && verifiedEmail.trim().toLowerCase() !== (localLogin ? localReviewer : email)) {
      return Response.json({ error: "Your current ChatGPT account differs from the reviewer email. Sign out and use the matching account." },
        { status: 403, headers: noStore });
    }
  }
  const value = loggedIn ? (reviewerLogin ? "review" : "1") : "; Max-Age=0";
  const cookie = demoCookie + "=" + value + "; Path=/; HttpOnly; SameSite=Lax" + secure;
  const { platformSignedIn } = storySession(request.headers);
  const intent = new URLSearchParams();
  if (url.searchParams.get("share") === "1") intent.set("share", "1");
  if (url.searchParams.get("welcome") === "1") intent.set("welcome", "1");
  let path = intent.size ? "/?" + intent.toString() : "/";
  let topLevel = false;
  if (!loggedIn) {
    path = platformSignedIn ? chatGPTSignOutPath("/login") : "/login";
    topLevel = platformSignedIn;
  } else if (reviewerLogin) {
    path = platformSignedIn ? "/admin" : chatGPTSignInPath("/admin");
    topLevel = !platformSignedIn;
  } else if (intent.has("share") && !platformSignedIn) {
    path = chatGPTSignInPath(path);
    topLevel = true;
  }
  return Response.json({ path, topLevel }, { headers: { ...noStore, "Set-Cookie": cookie } });
}

export function POST(request: Request) { return update(request, true); }
export function DELETE(request: Request) { return update(request, false); }
