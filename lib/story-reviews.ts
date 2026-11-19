import { and, asc, count, desc, eq, gt, lt, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { stories } from "../db/schema";
import type { ReviewPage, ReviewStatus } from "./review-types";
import { storyIdPattern, storyVoice } from "./story-record";

export async function loadReviews(status: ReviewStatus, query: string, cursor?: string): Promise<ReviewPage> {
  const db = getDb();
  const available = eq(stories.removing, false);
  const order = status === "pending" ? asc : desc;
  const beyond = status === "pending" ? gt : lt;
  const [date, id] = cursor?.split("|") ?? [];
  const after = date && id && storyIdPattern.test(id)
    ? or(beyond(stories.createdAt, date), and(eq(stories.createdAt, date), beyond(stories.id, id))) : undefined;
  const search = query ? or(
    sql`instr(lower(${stories.title}), lower(${query})) > 0`,
    sql`instr(lower(${stories.name}), lower(${query})) > 0`,
  ) : undefined;
  const [totals, rows] = await db.batch([
    db.select({ status: stories.status, total: count() }).from(stories).where(available).groupBy(stories.status),
    db.select().from(stories).where(and(available, eq(stories.status, status), after, search))
      .orderBy(order(stories.createdAt), order(stories.id)).limit(21),
  ]);
  const counts = { pending: 0, approved: 0, declined: 0 };
  for (const item of totals) counts[item.status] = item.total;
  const page = rows.slice(0, 20);
  const last = page.at(-1);
  return {
    stories: page.map(row => ({
      ...storyVoice(row, null), status: row.status, createdAt: row.createdAt, reviewedAt: row.reviewedAt,
    })),
    counts, cursor: last && rows.length > page.length ? last.createdAt + "|" + last.id : null,
  };
}
