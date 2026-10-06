import { betterAuth } from "better-auth";
import { emailOTP, twoFactor } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";
import { getBooleanSetting } from "@/lib/platform-controls";
import { APIError } from "better-auth/api";

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
  appName: "Socialhub",
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
        before: async (user) => {
          if (!(await getBooleanSetting("registration.enabled", true))) {
            throw new APIError("BAD_REQUEST", { message: "Registration is currently disabled." });
          }
          return {
            data: {
              ...user,
              username: await createAvailableUsername(user.email),
            },
          };
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const row = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { isActive: true, deletedAt: true, suspendedUntil: true },
          });
          const now = new Date();
          if (row?.suspendedUntil && row.suspendedUntil <= now && !row.deletedAt) {
            await prisma.user.update({
              where: { id: session.userId },
              data: { isActive: true, suspensionReason: null, suspendedUntil: null },
            });
            return { data: session };
          }
          if (!row?.isActive || row.deletedAt || (row.suspendedUntil && row.suspendedUntil > now)) return false;
          return { data: session };
        },
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
  plugins: [
    twoFactor({ issuer: "Socialhub" }),
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 5,
      changeEmail: { enabled: true, verifyCurrentEmail: true },
      sendVerificationOnSignUp: true,
      overrideDefaultEmailVerification: true,
      async sendVerificationOTP({ email, otp, type }) {
        const purpose = type === "forget-password" ? "password reset" : type === "change-email" ? "email change" : "email verification";
        await sendTransactionalEmail({
          to: email,
          subject: type === "forget-password" ? "Your Socialhub password reset code" : type === "change-email" ? "Your Socialhub email change code" : "Your Socialhub verification code",
          text: `Your Socialhub ${purpose} code is ${otp}. This code expires in 10 minutes. If you did not request this, you can ignore this email.`,
          html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Socialhub ${purpose}</h2><p>Your verification code is:</p><p style="font-size:30px;font-weight:800;letter-spacing:8px">${otp}</p><p>This code expires in 10 minutes.</p><p>If you did not request this, you can ignore this email.</p></div>`,
        });
      },
    }),
  ],
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
      "/email-otp/send-verification-otp": { window: 60, max: 5 },
      "/email-otp/verify-email": { window: 60, max: 10 },
      "/email-otp/request-password-reset": { window: 60, max: 5 },
      "/email-otp/reset-password": { window: 60, max: 10 },
      "/email-otp/request-email-change": { window: 60, max: 5 },
      "/email-otp/change-email": { window: 60, max: 10 },
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendTransactionalEmail({
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
      });
    },
  },
  baseURL: {
    allowedHosts: [
      "socialhub-ruby.vercel.app",
      "socialhub-firdousratherr.vercel.app",
      "*.vercel.app",
    ],
    protocol: process.env.NODE_ENV === "development" ? "http" : "https",
    fallback: "https://socialhub-ruby.vercel.app",
  },
  trustedOrigins: [
    "https://socialhub-ruby.vercel.app",
    "https://socialhub-firdousratherr.vercel.app",
    "https://*.vercel.app",
    "socialhub://",
    "socialhub://*",
  ],
  secret: process.env.BETTER_AUTH_SECRET,
});
