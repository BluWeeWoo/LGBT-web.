import { env } from "cloudflare:workers";
import { storyVoice, type AtlasRecord } from "./story-record";
import type { ReviewPage } from "./review-types";

type HeaderSource = Pick<Headers, "get">;
export const mysqlSessionCookie = "rye_session";
export const mysqlEnabled = () => Boolean(env.RYE_MYSQL_API_URL || env.RYE_MYSQL_API_TOKEN);
const noStore = { "Cache-Control": "private, no-store" };

function tokenFrom(headers: HeaderSource) {
  return /(?:^|;\s*)rye_session=([a-f0-9]{64})(?:;|$)/.exec(headers.get("cookie") || "")?.[1] || "";
}

class MysqlError extends Error {
  constructor(readonly status: number, message: string, readonly field?: string) { super(message); }
}

type Action = "session" | "authenticate" | "logout" | "publicStories" | "submitStory" |
  "deleteStory" | "reviewQueue" | "reviewStory" | "photo";

async function gateway(headers: HeaderSource, action: Action, input: object) {
  const endpoint = new URL(env.RYE_MYSQL_API_URL || "");
  const token = env.RYE_MYSQL_API_TOKEN;
  const loopback = ["127.0.0.1", "[::1]", "localhost"].includes(endpoint.hostname);
  if (!token || token.length < 32 || endpoint.username || endpoint.password ||
      (endpoint.protocol !== "https:" && !(loopback && endpoint.protocol === "http:"))) {
    throw new Error("Check the database service configuration.");
  }
  const response = await fetch(endpoint, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(12000),
    headers: { "Content-Type": "application/json", "X-Rye-Api-Key": token,
      "X-Rye-Action": action, "X-Rye-Session": tokenFrom(headers) },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const failure = await response.json<{ error?: string; field?: string }>().catch(() => null);
    throw new MysqlError(response.status, failure?.error || "The story database is unavailable.", failure?.field);
  }
  return response;
}

export async function mysqlAction<T>(headers: HeaderSource, action: Action, input: object = {}): Promise<T> {
  return (await gateway(headers, action, input)).json<T>();
}

export function mysqlFailure(cause: unknown) {
  const failure = cause instanceof MysqlError ? cause : new MysqlError(503, "The story database is unavailable. Please try again.");
  return Response.json({ error: failure.message, field: failure.field }, { status: failure.status, headers: noStore });
}

export async function mysqlSession(headers: HeaderSource) {
  // Anonymous visitors can explore the built-in atlas even when the database is down.
  const current = tokenFrom(headers) ? await mysqlAction<{ loggedIn: boolean; canReview: boolean }>(headers, "session") :
    { loggedIn: false, canReview: false };
  return { ...current, canShare: current.loggedIn, platformSignedIn: false };
}

type RecordPage = { records: AtlasRecord[]; viewer: string | null; cursor: string | null };
export async function mysqlPublicStories(request: Request) {
  const params = new URL(request.url).searchParams;
  const page = await mysqlAction<RecordPage>(request.headers, "publicStories", {
    id: params.get("id") ?? undefined, cursor: params.get("cursor") ?? undefined,
  });
  const stories = page.records.map(row => storyVoice(row, page.viewer));
  return Response.json(params.has("id") ? { story: stories[0] } :
    { stories, signedIn: Boolean(page.viewer), cursor: page.cursor }, { headers: noStore });
}

export async function mysqlReviewPage(headers: HeaderSource, status: string, query: string, cursor?: string): Promise<ReviewPage> {
  const page = await mysqlAction<RecordPage & Pick<ReviewPage, "counts">>(headers, "reviewQueue", { status, query, cursor });
  return { counts: page.counts, cursor: page.cursor, stories: page.records.map(row => ({
    ...storyVoice(row, null), status: row.status, createdAt: row.createdAt, reviewedAt: row.reviewedAt,
  })) };
}

export async function mysqlPhoto(request: Request, id: string, index: string) {
  const response = await gateway(request.headers, "photo", { id, index });
  if (response.headers.get("content-type") !== "image/jpeg") throw new Error("Invalid photo response.");
  return new Response(response.body, { headers: { ...noStore, "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff" } });
}
