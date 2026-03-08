import { betterAuth } from "better-auth";
import { createFullId } from "shared";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import PlunkModule from "@plunk/node";
import { db, user, session, account, verification } from "db";

const appName = process.env.APP_NAME ?? "Tab It";
const plunkSecret = process.env.PLUNK_SECRET_KEY;
const plunkBaseUrl = process.env.PLUNK_BASE_URL;

const PlunkClass =
  (
    PlunkModule as unknown as {
      default?: new (
        key: string,
        opts?: { baseUrl: string },
      ) => {
        emails: {
          send: (opts: {
            to: string;
            subject: string;
            body: string;
          }) => Promise<unknown>;
        };
      };
    }
  ).default ??
  (PlunkModule as unknown as new (
    key: string,
    opts?: { baseUrl: string },
  ) => {
    emails: {
      send: (opts: {
        to: string;
        subject: string;
        body: string;
      }) => Promise<unknown>;
    };
  });
const plunk =
  plunkSecret && plunkBaseUrl
    ? new PlunkClass(plunkSecret, { baseUrl: plunkBaseUrl })
    : null;

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
              subject: `Sign in to ${appName}: ${otp}`,
              body: `Your sign-in code for ${appName} is: ${otp}\n\nThis code expires in 5 minutes.`,
            });
          } else {
            console.log("OTP (no Plunk configured):", otp);
          }
        } else if (type === "email-verification") {
          if (plunk) {
            await plunk.emails.send({
              to: email,
              subject: `Verify your email for ${appName}: ${otp}`,
              body: `Your verification code for ${appName} is: ${otp}\n\nThis code expires in 5 minutes.`,
            });
          } else {
            console.log("Verification OTP (no Plunk configured):", otp);
          }
        } else {
          if (plunk) {
            await plunk.emails.send({
              to: email,
              subject: `Reset your password for ${appName}`,
              body: `Your password reset code for ${appName} is: ${otp}\n\nThis code expires in 5 minutes.`,
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
    process.env.API_URL ?? "http://localhost:3001",
    process.env.NOTIFICATIONS_WS_URL ?? "http://localhost:3002",
  ],
});
