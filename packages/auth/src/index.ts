import { betterAuth } from "better-auth";
import { createFullId } from "shared";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import PlunkModule from "@plunk/node";
import { db, user, session, account, verification } from "db";
import { sendDiscordWebhook } from "shared";

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
      defaultCurrency: {
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
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const content = [`New user: ${user.email}`].join("\n");
          sendDiscordWebhook(content);
        },
      },
    },
  },
  advanced: {
    database: {
      generateId: () => createFullId(),
    },
    ...(process.env.BETTER_AUTH_COOKIE_DOMAIN && {
      crossSubDomainCookies: {
        enabled: true,
        domain: process.env.BETTER_AUTH_COOKIE_DOMAIN,
      },
    }),
  },
  emailAndPassword: {
    enabled: false,
  },
  plugins: [
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        const send = async () => {
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
        };
        try {
          await send();
        } catch (err) {
          console.error(
            "Failed to send OTP email, falling back to console:",
            err,
          );
          console.log("OTP for", email, ":", otp);
        }
      },
      expiresIn: 60 * 5,
    }),
  ],
  baseURL: process.env.BETTER_AUTH_URL ?? "https://localhost:3003",
  trustedOrigins: [
    process.env.NEXT_PUBLIC_PWA_URL!,
    "https://localhost:3003",
    "http://localhost:3003",
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS
      ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((o) => o.trim())
      : []),
  ],
});
