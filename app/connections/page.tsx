import type { Metadata } from "next";
import Connections from "../../components/Connections";

export const metadata: Metadata = {
  title: "Connections · RYE",
  robots: { index: false, follow: false },
};

export default function ConnectionsPage() {
  return <Connections />;
}
