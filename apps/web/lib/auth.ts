import { betterAuth } from "better-auth";
import { appConfig } from "@/app/config";
import { createFullId } from "shared";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import Plunk from "@plunk/node";
import { db, user, session, account, verification } from "db";

const plunk = new Plunk(process.env.PLUNK_SECRET_KEY!, {
  baseUrl: process.env.PLUNK_BASE_URL!,
});

export const auth = betterAuth({
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: false,
        defaultValue: null,
        input: true,
      },
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),
  advanced: {
    database: {
      generateId: () => createFullId(),
    },
  },
  emailAndPassword: {
    enabled: false,
  },
  plugins: [
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type === "sign-in") {
          if (plunk) {
            await plunk.emails.send({
              to: email,
              subject: `Sign in to ${appConfig.name}: ${otp}`,
              body: `Your sign-in code for ${appConfig.name} is: ${otp}\n\nThis code expires in 5 minutes.`,
            });
          } else {
            console.log("OTP (no Plunk configured):", otp);
          }
        } else if (type === "email-verification") {
          if (plunk) {
            await plunk.emails.send({
              to: email,
              subject: `Verify your email for ${appConfig.name}: ${otp}`,
              body: `Your verification code for ${appConfig.name} is: ${otp}\n\nThis code expires in 5 minutes.`,
            });
          } else {
            console.log("Verification OTP (no Plunk configured):", otp);
          }
        } else {
          if (plunk) {
            await plunk.emails.send({
              to: email,
              subject: `Reset your password for ${appConfig.name}`,
              body: `Your password reset code for ${appConfig.name} is: ${otp}\n\nThis code expires in 5 minutes.`,
            });
          } else {
            console.log("Password reset OTP (no Plunk configured):", otp);
          }
        }
      },
      expiresIn: 60 * 5,
    }),
  ],
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    "https://localhost:3000",
  ],
});
