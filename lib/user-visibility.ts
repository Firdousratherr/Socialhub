import type { Prisma } from "@prisma/client";

export const publicUserWhere = {
  emailVerified: true,
  isActive: true,
  deletedAt: null,
} satisfies Prisma.UserWhereInput;
