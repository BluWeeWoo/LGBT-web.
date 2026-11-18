import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RYE — Raise Your Equality",
  description:
    "An interactive atlas of LGBTQ+ stories. Explore a voice from around the world or share an experience in your own words.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
