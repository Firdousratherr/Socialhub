import * as z from "zod";

export const postInputSchema = z.object({
  content: z.string().trim().max(5000).optional().nullable(),
  mediaUrl: z.string().url().max(2048).optional().nullable(),
  visibility: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]).default("PUBLIC"),
}).refine(
  (value) => Boolean(value.content) || Boolean(value.mediaUrl),
  "A post needs text or media.",
);

export const profileInputSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  username: z.string().trim().regex(/^[A-Za-z0-9_]{3,30}$/).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  image: z.string().url().max(2048).nullable().optional(),
  coverImage: z.string().url().max(2048).nullable().optional(),
  website: z.string().url().max(2048).nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  isPrivate: z.boolean().optional(),
});

export const conversationInputSchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1).max(50),
  title: z.string().trim().max(100).nullable().optional(),
  isGroup: z.boolean().default(false),
});

export const messageInputSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

export const commentInputSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  parentId: z.string().min(1).nullable().optional(),
});

export const storyInputSchema = z.object({
  mediaUrl: z.string().url().max(2048),
  caption: z.string().trim().max(300).nullable().optional(),
  audience: z.enum(["PUBLIC", "FRIENDS"]).default("PUBLIC"),
  expiresAt: z.coerce.date(),
});

export const friendRequestInputSchema = z.object({
  receiverId: z.string().min(1),
});

export const notificationUpdateSchema = z.object({
  notificationId: z.string().min(1).optional(),
  markAll: z.boolean().optional(),
}).refine(
  (value) => Boolean(value.notificationId) || value.markAll === true,
  "Provide a notification id or markAll=true.",
);
