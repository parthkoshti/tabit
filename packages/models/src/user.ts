import { z } from "zod";

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
});

export type User = z.infer<typeof userSchema>;
