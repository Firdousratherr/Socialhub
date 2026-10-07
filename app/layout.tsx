import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  metadataBase: new URL("https://socialhublive.vercel.app"),
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          name="google-adsense-account"
          content="ca-pub-7750685317490181"
        />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7750685317490181"
          crossOrigin="anonymous"
        />
      </head>
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
