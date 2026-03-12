import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.NEXT_PUBLIC_PWA_URL ?? "http://localhost:3003",
  plugins: [
    emailOTPClient(),
    inferAdditionalFields({
      user: {
        username: { type: "string", required: false },
      },
    }),
  ],
});
