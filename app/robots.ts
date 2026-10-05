import type { MetadataRoute } from "next";

const SITE_URL = "https://socialhub-ruby.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/home",
        "/settings",
        "/messages",
        "/notifications",
        "/friends",
        "/discover",
        "/saved",
        "/two-factor",
        "/profile/me",
      ],
    },
    sitemap: SITE_URL + "/sitemap.xml",
  };
}
