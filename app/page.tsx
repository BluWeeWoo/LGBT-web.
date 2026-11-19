import { headers } from "next/headers";
import Atlas from "../components/Atlas";
import { storySession } from "../lib/story-access";
import { chatGPTSignInPath } from "./chatgpt-auth";

export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const session = storySession(await headers());
  const welcome = session.loggedIn && (await searchParams).welcome === "1";
  return <Atlas initialSession={session} initialWelcome={welcome} publishLogin={chatGPTSignInPath("/?share=1")} />;
}
