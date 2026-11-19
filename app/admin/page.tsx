import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { reviewerId } from "../../lib/admin-access";
import { reviewStates } from "../../lib/review-types";
import { storySession } from "../../lib/story-access";
import { loadReviews } from "../../lib/story-reviews";
import { mysqlEnabled, mysqlReviewPage, mysqlSession } from "../../lib/mysql";
import ReviewDesk from "../../components/ReviewDesk";
import "./review.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Story review · RYE", robots: { index: false, follow: false } };
type Query = { status?: string; q?: string; cursor?: string };

export default async function AdminPage({ searchParams }: { searchParams: Promise<Query> }) {
  const identity = await headers();
  const database = mysqlEnabled();
  const session = database ? await mysqlSession(identity) : { ...storySession(identity), canReview: Boolean(reviewerId(identity)) };
  if (!session.loggedIn) redirect("/login");
  if (!session.canReview) redirect("/");
  const params = await searchParams;
  const status = reviewStates.find(value => value === params.status) ?? "pending";
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const cursor = typeof params.cursor === "string" ? params.cursor : undefined;
  const page = await (database ? mysqlReviewPage(identity, status, query, cursor) : loadReviews(status, query, cursor)).catch(() => null);
  return <ReviewDesk key={JSON.stringify([status, query, cursor])} page={page} status={status} query={query} paged={Boolean(cursor)}/>;
}
