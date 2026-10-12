import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppDownloadFooter } from "@/components/app-download-footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://socialhublive.vercel.app"),
  title: {
    default: "Socialhub — Connect. Share. Belong.",
    template: "%s · Socialhub",
  },
  description:
    "A modern social network for sharing moments, discovering people, and staying connected.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // proxy.ts generates a fresh nonce for each request. Pass it to the
  // third-party AdSense script as well as Next.js-generated scripts.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          name="google-adsense-account"
          content="ca-pub-7750685317490181"
        />
        <script
          nonce={nonce}
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7750685317490181"
          crossOrigin="anonymous"
        />
      </head>
      <body><ThemeProvider>{children}</ThemeProvider><AppDownloadFooter /></body>
    </html>
  );
}
