import { chatGPTSignInPath, chatGPTSignOutPath } from "../../chatgpt-auth";
import { demoCookie, storySession } from "../../../lib/story-access";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

export function GET(request: Request) {
  return Response.json(storySession(request.headers), { headers: noStore });
}

function update(request: Request, loggedIn: boolean) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if ((origin && origin !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ error: "Use the login form on RYE." }, { status: 403, headers: noStore });
  }
  const secure = url.protocol === "https:" ? "; Secure" : "";
  const cookie = demoCookie + (loggedIn ? "=1" : "=; Max-Age=0") + "; Path=/; HttpOnly; SameSite=Lax" + secure;
  const { platformSignedIn } = storySession(request.headers);
  const intent = new URLSearchParams();
  if (url.searchParams.get("share") === "1") intent.set("share", "1");
  if (url.searchParams.get("welcome") === "1") intent.set("welcome", "1");
  let path = intent.size ? "/?" + intent.toString() : "/";
  let topLevel = false;
  if (!loggedIn) {
    path = platformSignedIn ? chatGPTSignOutPath("/login") : "/login";
    topLevel = platformSignedIn;
  } else if (intent.has("share") && !platformSignedIn) {
    path = chatGPTSignInPath(path);
    topLevel = true;
  }
  return Response.json({ path, topLevel }, { headers: { ...noStore, "Set-Cookie": cookie } });
}

export function POST(request: Request) { return update(request, true); }
export function DELETE(request: Request) { return update(request, false); }
