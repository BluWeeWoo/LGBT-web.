import DemoAuth from "../../components/DemoAuth";
import { mysqlEnabled } from "../../lib/mysql";

export const dynamic = "force-dynamic";

export const metadata = { title: "Log in · RYE" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <DemoAuth mode="login" forShare={(await searchParams).next === "share"} databaseAccount={mysqlEnabled()} />;
}
