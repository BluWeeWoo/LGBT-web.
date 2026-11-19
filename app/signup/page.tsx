import DemoAuth from "../../components/DemoAuth";

export const metadata = { title: "Sign up · RYE" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <DemoAuth mode="signup" forShare={(await searchParams).next === "share"} />;
}
