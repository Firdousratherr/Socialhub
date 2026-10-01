import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
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
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});
