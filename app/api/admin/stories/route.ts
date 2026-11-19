import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { stories } from "../../../../db/schema";
import { reviewerId } from "../../../../lib/admin-access";
import { storyIdPattern } from "../../../../lib/story-record";
import { mysqlAction, mysqlEnabled, mysqlFailure } from "../../../../lib/mysql";

export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function PATCH(request: Request) {
  const reviewer = reviewerId(request.headers);
  if (!mysqlEnabled() && !reviewer) return reply({ error: "Sign in with an authorized reviewer account." }, 403);
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site")
    return reply({ error: "Review stories from the RYE dashboard." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply({ error: "Use the review form." }, 415);
  const input = await request.json<{ id?: unknown; status?: unknown }>().catch(() => null);
  if (typeof input?.id !== "string" || !storyIdPattern.test(input.id) ||
      (input.status !== "approved" && input.status !== "declined"))
    return reply({ error: "Choose a story and a review decision." }, 400);

  if (mysqlEnabled()) return mysqlAction<{ status: string }>(request.headers, "reviewStory", { id: input.id, status: input.status })
    .then(result => reply(result)).catch(mysqlFailure);
  try {
    const db = getDb();
    const available = and(eq(stories.id, input.id), eq(stories.removing, false));
    const [updated] = await db.update(stories)
      .set({ status: input.status, reviewedBy: reviewer, reviewedAt: new Date().toISOString() })
      .where(and(available, eq(stories.status, "pending"))).returning({ status: stories.status });
    if (updated) return reply(updated);
    const [current] = await db.select({ status: stories.status }).from(stories).where(available).limit(1);
    if (!current) return reply({ error: "This submission is no longer available." }, 404);
    if (current.status === input.status) return reply(current);
    return reply({ error: "Another reviewer already decided this story. Refresh the queue to continue." }, 409);
  } catch {
    return reply({ error: "Could not save this decision. Please try again." }, 503);
  }
}
