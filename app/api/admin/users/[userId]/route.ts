import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/api/admin/_auth";

const metricSchema = z.object({
  posts: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  followers: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  following: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  likesReceived: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  commentsReceived: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  shares: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  profileViews: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  username: z.string().trim().regex(/^[A-Za-z0-9_]{3,30}$/).nullable().optional(),
  role: z.enum(["USER", "MODERATOR", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  metrics: metricSchema.optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const access = await requireAdmin();
  if (access.response) return access.response;
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, username: true, email: true, image: true, bio: true, coverImage: true,
      website: true, location: true, role: true, isActive: true, isPrivate: true, isVerified: true, isOwner: true,
      verifiedAt: true, ownerSince: true, emailVerified: true, createdAt: true, updatedAt: true,
      _count: {
        select: {
          posts: true, likes: true, comments: true, followers: true, following: true,
          stories: true, savedPosts: true, sentFriendRequests: true, receivedFriendRequests: true,
          filedReports: true, reportedIn: true, blockedUsers: true, blockedBy: true,
        },
      },
    },
  });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const [override, actualLikesReceived, actualCommentsReceived, actualShares, recentReports, recentAudit, recentSessions, recentVerification] = await Promise.all([
    prisma.adminMetricOverride.findUnique({ where: { userId } }),
    prisma.like.count({ where: { post: { authorId: userId } } }),
    prisma.comment.count({ where: { post: { authorId: userId } } }),
    prisma.post.aggregate({ where: { authorId: userId }, _sum: { shareCount: true } }),
    prisma.report.findMany({
      where: { OR: [{ reporterId: userId }, { reportedUserId: userId }] },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, reason: true, status: true, createdAt: true, reporterId: true, reportedUserId: true },
    }),
    prisma.adminAuditLog.findMany({
      where: { targetType: "USER", targetId: userId },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, adminId: true, action: true, details: true, createdAt: true },
    }),
    prisma.session.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, createdAt: true, updatedAt: true, expiresAt: true, ipAddress: true, userAgent: true },
    }),
    prisma.verificationAudit.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, action: true, reason: true, createdAt: true, adminId: true },
    }),
  ]);

  await prisma.adminAuditLog.create({
    data: {
      adminId: access.user.id,
      action: "VIEW_USER_360",
      targetType: "USER",
      targetId: userId,
    },
  });

  return NextResponse.json({
    user,
    override,
    actualMetrics: {
      posts: user._count.posts,
      followers: user._count.followers,
      following: user._count.following,
      likesReceived: actualLikesReceived,
      commentsReceived: actualCommentsReceived,
      shares: actualShares._sum.shareCount ?? 0,
      profileViews: 0,
    },
    recentReports,
    recentAudit,
    recentSessions,
    recentVerification,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const access = await requireAdmin();
  if (access.response) return access.response;
  const { userId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid user update." }, { status: 400 });

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true, role: true, isActive: true, isPrivate: true, emailVerified: true, isVerified: true, isOwner: true },
  });
  if (!before) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const { metrics, ...userPatch } = parsed.data;
  const patch = userPatch;
  if (metrics !== undefined && access.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only administrators can change profile metric overrides." }, { status: 403 });
  }
  if (patch.isVerified !== undefined && patch.isVerified !== before.isVerified && access.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only administrators can change verification status." }, { status: 403 });
  }
  if (before.isOwner && patch.isVerified === false) {
    return NextResponse.json({ error: "The owner account cannot have its verification badge removed." }, { status: 400 });
  }
  if (before.isOwner && access.user.id !== userId && (patch.role !== undefined || patch.isActive !== undefined || patch.emailVerified !== undefined)) {
    return NextResponse.json({ error: "The owner account is protected from role, activation and email-verification changes by other administrators." }, { status: 403 });
  }
  if (patch.role && patch.role !== before.role && access.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only administrators can change user roles." }, { status: 403 });
  }
  if (access.user.id === userId && ((patch.role && patch.role !== "ADMIN") || patch.isActive === false)) {
    return NextResponse.json({ error: "You cannot disable or demote your own administrator account." }, { status: 400 });
  }
  if (access.user.role !== "ADMIN" && (before.role === "ADMIN" || (patch.role && patch.role === "ADMIN"))) {
    return NextResponse.json({ error: "Moderators cannot modify administrator accounts." }, { status: 403 });
  }

  try {
    const verificationChanged = patch.isVerified !== undefined && patch.isVerified !== before.isVerified;
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...patch,
        ...(verificationChanged ? { verifiedAt: patch.isVerified ? new Date() : null } : {}),
      },
      select: {
        id: true, name: true, username: true, email: true, image: true, role: true,
        isActive: true, isPrivate: true, isVerified: true, isOwner: true, verifiedAt: true, ownerSince: true, emailVerified: true, createdAt: true,
        _count: { select: { posts: true, followers: true, following: true } },
      },
    });

    if (verificationChanged) {
      await prisma.verificationAudit.create({
        data: {
          userId,
          adminId: access.session!.user.id,
          action: patch.isVerified ? "GRANTED" : "REVOKED",
          reason: patch.isVerified ? "Verified by an administrator." : "Verification removed by an administrator.",
        },
      });
    }
    if (verificationChanged) {
      await prisma.notification.create({
        data: {
          userId,
          actorId: access.session!.user.id,
          type: "SYSTEM",
          title: patch.isVerified ? "Verification approved" : "Verification removed",
          body: patch.isVerified ? "Your account has received the blue verification badge." : "Your blue verification badge was removed by an administrator.",
        },
      });
    }

    if (metrics !== undefined) {
      const hasOverride = Object.values(metrics).some((value) => value !== null && value !== undefined);
      const previousMetrics = await prisma.adminMetricOverride.findUnique({ where: { userId } });

      if (hasOverride) {
        await prisma.adminMetricOverride.upsert({
          where: { userId },
          create: { userId, ...metrics },
          update: { ...metrics },
        });
      } else {
        await prisma.adminMetricOverride.deleteMany({ where: { userId } });
      }

      await prisma.adminAuditLog.create({
        data: {
          adminId: access.session!.user.id,
          action: "UPDATE_PROFILE_METRICS",
          targetType: "USER",
          targetId: userId,
          details: JSON.stringify({
            before: previousMetrics,
            after: hasOverride ? metrics : null,
            reset: !hasOverride,
          }),
        },
      });
    }

    await prisma.adminAuditLog.create({
      data: {
        adminId: access.session!.user.id,
        action: "UPDATE_USER",
        targetType: "USER",
        targetId: userId,
        details: JSON.stringify({ before, after: patch }),
      },
    });

    const override = await prisma.adminMetricOverride.findUnique({ where: { userId } });
    return NextResponse.json({ user, override });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not update user." }, { status: 500 });
  }
}
