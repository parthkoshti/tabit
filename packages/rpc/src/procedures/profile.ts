import { z } from "zod";
import { userService } from "services";
import { authed } from "../auth-middleware.js";
import { unwrap } from "../utils.js";

const profileUpdateSchema = z.object({
  name: z.string().nullable().optional(),
  defaultCurrency: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
});

export const profileProcedures = {
  update: authed.input(profileUpdateSchema).handler(async ({ context, input }) => {
    const updates: {
      name?: string | null;
      defaultCurrency?: string | null;
      timezone?: string | null;
    } = {};
    if ("name" in input) {
      updates.name =
        input.name === null || input.name === undefined
          ? null
          : input.name.trim() || null;
    }
    if ("defaultCurrency" in input) {
      updates.defaultCurrency =
        input.defaultCurrency === null || input.defaultCurrency === undefined
          ? null
          : input.defaultCurrency.trim() || null;
    }
    if ("timezone" in input) {
      updates.timezone =
        input.timezone === null || input.timezone === undefined
          ? null
          : input.timezone.trim() || null;
    }
    unwrap(await userService.updateProfile(context.userId!, updates));
    return {};
  }),
};
