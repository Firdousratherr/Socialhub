import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";

function usernameBaseFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const normalized = localPart
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 24);

  if (normalized.length >= 3) return normalized;
  return "member";
}

async function createAvailableUsername(email: string) {
  const base = usernameBaseFromEmail(email);

  if (!(await prisma.user.findUnique({ where: { username: base }, select: { id: true } }))) {
    return base;
  }

  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const suffixText = String(suffix);
    const candidate = `${base.slice(0, Math.max(1, 30 - suffixText.length - 1))}_${suffixText}`;

    if (!(await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } }))) {
      return candidate;
    }
  }

  throw new Error("Could not generate an available username.");
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({
          data: {
            ...user,
            username: await createAvailableUsername(user.email),
          },
        }),
      },
    },
  },
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        socialProviders: {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        },
      }
    : {}),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      void sendTransactionalEmail({
        to: user.email,
        subject: "Reset your Socialhub password",
        text: [
          `Hi ${user.name},`,
          "",
          "We received a request to reset your Socialhub password.",
          `Open this link to choose a new password: ${url}`,
          "",
          "This link expires in 1 hour. If you did not request this, you can ignore this email.",
        ].join("\n"),
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Reset your Socialhub password</h2><p>Hi ${user.name},</p><p>We received a request to reset your password.</p><p><a href="${url}">Reset your password</a></p><p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p></div>`,
      }).catch((error) => {
        console.error("Socialhub password reset email failed", error);
      });
    },
  },
  baseURL: {
    allowedHosts: [
      "socialhub-ruby.vercel.app",
      "socialhub-firdousratherr.vercel.app",
      "*.vercel.app",
      "localhost:3000",
      "localhost:3001",
    ],
    protocol: process.env.NODE_ENV === "development" ? "http" : "https",
    fallback: "https://socialhub-ruby.vercel.app",
  },
  trustedOrigins: [
    "https://socialhub-ruby.vercel.app",
    "https://socialhub-firdousratherr.vercel.app",
    "https://*.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
  ],
  secret: process.env.BETTER_AUTH_SECRET,
});
