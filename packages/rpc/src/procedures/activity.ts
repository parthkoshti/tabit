import { z } from "zod";
import { activity } from "data";
import { authed } from "../auth-middleware.js";

export const activityProcedures = {
  list: authed
    .input(
      z.object({
        limit: z.number().int().optional(),
        offset: z.number().int().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const limit = input.limit ?? 50;
      const offset = input.offset ?? 0;
      const result = await activity.getForUser(context.userId!, { limit, offset });
      const items =
        typeof result === "object" && "items" in result ? result.items : result;
      const total =
        typeof result === "object" && "total" in result
          ? result.total
          : items.length;
      return { items, total };
    }),
};
