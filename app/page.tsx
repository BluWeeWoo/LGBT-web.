import { headers } from "next/headers";
import Atlas from "../components/Atlas";

export const dynamic = "force-dynamic";
export default async function Home() {
  const user = (await headers()).get("oai-authenticated-user-id");
  return <Atlas signedIn={Boolean(user)} />;
}
