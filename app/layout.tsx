import type { Metadata } from "next";
import Script from "next/script";
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
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7750685317490181"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
    </html>
  );
}
