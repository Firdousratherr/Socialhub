import { prisma } from "@/lib/prisma";

export type UserRestrictionKey =
  | "postingRestrictedUntil"
  | "commentingRestrictedUntil"
  | "messagingRestrictedUntil"
  | "socialRestrictedUntil";

export async function getActiveUserRestriction(userId: string, key: UserRestrictionKey) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { [key]: true },
  }) as Record<UserRestrictionKey, Date | null> | null;
  const until = row?.[key] ?? null;
  return until && until > new Date() ? until : null;
}
