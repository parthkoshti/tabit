import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import Plunk from "@plunk/node";
import { db, user, session, account, verification } from "db";

const plunk = new Plunk(process.env.PLUNK_SECRET_KEY!, {
  baseUrl: process.env.PLUNK_BASE_URL!,
});

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),
  emailAndPassword: {
    enabled: false,
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        if (plunk) {
          await plunk.emails.send({
            to: email,
            subject: "Sign in to Tabit",
            body: `Click the link below to sign in to Tabit:\n\n${url}\n\nThis link expires in 5 minutes.`,
          });
        } else {
          console.log("Magic link (no Plunk configured):", url);
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
