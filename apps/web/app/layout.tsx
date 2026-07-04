import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adventure AI — AI that runs your company while you sleep",
  description:
    "An autonomous AI co-founder that plans, builds, markets, and operates your online business 24/7.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://adventureadvertising.in"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
