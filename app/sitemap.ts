import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const SITE_URL = "https://socialhub-ruby.vercel.app";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const users = await prisma.user.findMany({
    where: {
      username: { not: null },
      isActive: true,
      deletedAt: null,
      isPrivate: false,
    },
    select: {
      username: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: SITE_URL + "/login",
      changeFrequency: "monthly",
      priority: 0.2,
    },
    {
      url: SITE_URL + "/signup",
      changeFrequency: "monthly",
      priority: 0.4,
    },
    ...users
      .filter((user): user is { username: string; updatedAt: Date } => Boolean(user.username))
      .map((user) => ({
        url: SITE_URL + "/profile/" + encodeURIComponent(user.username),
        lastModified: user.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
  ];
}
