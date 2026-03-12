import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000",
  plugins: [
    emailOTPClient(),
    inferAdditionalFields({
      user: {
        username: { type: "string", required: false },
      },
    }),
  ],
});
