import * as z from "zod";

function isTrustedMediaUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.hostname.endsWith(".public.blob.vercel-storage.com")) return true;
    const configured = (process.env.MEDIA_URL_HOSTS ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
    return configured.includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

const mediaUrlSchema = z.string().url().max(2048).refine(isTrustedMediaUrl, "Media must be uploaded through an approved storage host.");

const postMediaInputSchema = z.object({
  url: mediaUrlSchema,
  mimeType: z.string().trim().max(100),
  mediaType: z.enum(["IMAGE", "VIDEO", "DOCUMENT"]),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  durationMs: z.number().int().nonnegative().max(3600000).optional(),
});

const pollInputSchema = z.object({
  question: z.string().trim().min(1).max(300),
  options: z.array(z.string().trim().min(1).max(100)).min(2).max(10),
  multiple: z.boolean().default(false),
  closesAt: z.coerce.date().nullable().optional(),
});

export const postInputSchema = z.object({
  content: z.string().trim().max(5000).optional().nullable(),
  mediaUrl: mediaUrlSchema.optional().nullable(),
  media: z.array(postMediaInputSchema).max(10).optional().default([]),
  poll: pollInputSchema.optional(),
  visibility: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]).default("PUBLIC"),
}).refine(
  (value) => Boolean(value.content) || Boolean(value.mediaUrl) || value.media.length > 0 || Boolean(value.poll),
  "A post needs text, media, or a poll.",
);

export const profileInputSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  username: z.string().trim().regex(/^[A-Za-z0-9_]{3,30}$/).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  image: mediaUrlSchema.optional().nullable(),
  coverImage: mediaUrlSchema.optional().nullable(),
  website: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().url("Enter a valid URL, such as https://example.com").max(2048).nullable().optional(),
  ),
  location: z.string().trim().max(120).nullable().optional(),
  isPrivate: z.boolean().optional(),
});

export const conversationInputSchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1).max(50),
  title: z.string().trim().max(100).nullable().optional(),
  isGroup: z.boolean().default(false),
});

export const messageInputSchema = z.object({
  content: z.string().trim().max(5000).default(""),
  attachments: z.array(mediaUrlSchema).max(4).default([]),
}).refine((value) => Boolean(value.content.trim()) || value.attachments.length > 0, "Message needs text or an attachment.");

export const commentInputSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  parentId: z.string().min(1).nullable().optional(),
});

export const storyInputSchema = z.object({
  mediaUrl: mediaUrlSchema,
  mediaType: z.enum(["IMAGE", "VIDEO"]).default("IMAGE"),
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
