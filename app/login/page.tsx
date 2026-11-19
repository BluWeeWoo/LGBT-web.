import DemoAuth from "../../components/DemoAuth";

export const metadata = { title: "Log in · RYE" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <DemoAuth mode="login" forShare={(await searchParams).next === "share"} />;
}
