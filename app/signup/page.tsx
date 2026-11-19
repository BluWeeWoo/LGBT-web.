import DemoAuth from "../../components/DemoAuth";
import { mysqlEnabled } from "../../lib/mysql";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign up · RYE" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <DemoAuth mode="signup" forShare={(await searchParams).next === "share"} databaseAccount={mysqlEnabled()} />;
}
