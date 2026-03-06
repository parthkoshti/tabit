import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(5, "Username must be at least 5 characters")
  .max(12, "Username must be at most 12 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  username: z.string().nullable(),
});

export type User = z.infer<typeof userSchema>;
