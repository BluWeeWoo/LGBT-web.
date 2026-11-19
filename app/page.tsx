import { headers } from "next/headers";
import Atlas from "../components/Atlas";
import { storySession } from "../lib/story-access";
import { chatGPTSignInPath } from "./chatgpt-auth";
import { reviewerId } from "../lib/admin-access";
import { mysqlEnabled, mysqlSession } from "../lib/mysql";

export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const identity = await headers();
  const session = mysqlEnabled()
    ? await mysqlSession(identity).catch(() => ({ loggedIn: false, platformSignedIn: false, canReview: false, canShare: false }))
    : { ...storySession(identity), canReview: Boolean(reviewerId(identity)) };
  const welcome = session.loggedIn && (await searchParams).welcome === "1";
  return <Atlas initialSession={session} initialWelcome={welcome} publishLogin={chatGPTSignInPath("/?share=1")} />;
}
