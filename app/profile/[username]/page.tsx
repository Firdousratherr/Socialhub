import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publicUserWhere } from "@/lib/user-visibility";
import { SocialPages } from "@/components/social-pages";

const SITE_URL = "https://socialhub-ruby.vercel.app";

type Props = {
  params: Promise<{ username: string }>;
};

function absoluteProfileUrl(username: string) {
  return SITE_URL + "/profile/" + encodeURIComponent(username);
}

function safeExternalUrl(value: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

async function getProfile(username: string) {
  return prisma.user.findFirst({
    where: { ...publicUserWhere, username },
    select: {
      id: true,
      username: true,
      name: true,
      bio: true,
      image: true,
      website: true,
      isPrivate: true,
      isActive: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          posts: true,
          followers: true,
        },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;

  if (username === "me") {
    return {
      title: "My Profile",
      robots: { index: false, follow: false },
    };
  }

  const user = await getProfile(username);

  if (!user || !user.isActive || user.deletedAt || !user.username) {
    return {
      title: "Profile not found",
      robots: { index: false, follow: false },
    };
  }
    return {
      title: "Profile not found",
      robots: { index: false, follow: false },
    };
  }

  const title = `${user.name} (@${user.username}) · Socialhub`;
  const description =
    user.bio?.trim() ||
    `View ${user.name}'s public profile on Socialhub and discover their posts and connections.`;
  const url = absoluteProfileUrl(user.username);

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: user.isPrivate
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      type: "profile",
      url,
      title,
      description,
      siteName: "Socialhub",
      ...(user.image
        ? { images: [{ url: user.image, alt: `${user.name}'s profile photo` }] }
        : {}),
    },
    twitter: {
      card: user.image ? "summary_large_image" : "summary",
      title,
      description,
      ...(user.image ? { images: [user.image] } : {}),
    },
  };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;

  if (username === "me") {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/login?next=/profile/me");

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { username: true },
    });

    if (!user?.username) redirect("/settings");
    redirect("/profile/" + encodeURIComponent(user.username));
  }

  const user = await getProfile(username);

  if (!user || !user.isActive || user.deletedAt || !user.username) {
    notFound();
  }

  const profileUrl = absoluteProfileUrl(user.username);
  const sameAs = safeExternalUrl(user.website);

  const profileSchema = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: profileUrl,
    dateCreated: user.createdAt.toISOString(),
    dateModified: user.updatedAt.toISOString(),
    mainEntity: {
      "@type": "Person",
      "@id": profileUrl + "#person",
      name: user.name,
      alternateName: user.username,
      identifier: user.id,
      ...(user.bio ? { description: user.bio } : {}),
      ...(user.image ? { image: user.image } : {}),
      ...(sameAs ? { sameAs: [sameAs] } : {}),
      ...(user.isPrivate
        ? {}
        : {
            interactionStatistic: [
              {
                "@type": "InteractionCounter",
                interactionType: "https://schema.org/FollowAction",
                userInteractionCount: user._count.followers,
              },
            ],
            agentInteractionStatistic: {
              "@type": "InteractionCounter",
              interactionType: "https://schema.org/WriteAction",
              userInteractionCount: user._count.posts,
            },
          }),
    },
  };

  const serializedSchema = JSON.stringify(profileSchema).replace(/</g, "\\u003c");

  return (
    <>
      {!user.isPrivate ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializedSchema }}
        />
      ) : null}
      <SocialPages screen={{ kind: "profile", username: user.username }} />
    </>
  );
}
