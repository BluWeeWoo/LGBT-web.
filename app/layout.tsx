import type { Metadata } from "next";
import "./globals.css";
import "./atlas.css";
import "./stories.css";
import "./auth.css";
import "./chat.css";

export const metadata: Metadata = {
  title: "RYE — Raise Your Equality",
  description:
    "An interactive atlas of LGBTQ+ stories. Explore a voice from around the world or share an experience in your own words.",
  icons: { icon: { url: "/rye-orbit-icon.png", type: "image/png", sizes: "64x64" } },
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
