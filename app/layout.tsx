import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Socialhub — Connect. Share. Belong.",
    template: "%s · Socialhub",
  },
  description:
    "A modern social network for sharing moments, discovering people, and staying connected.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
