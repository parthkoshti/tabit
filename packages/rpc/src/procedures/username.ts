import { z } from "zod";
import { userService } from "services";
import { authed } from "../auth-middleware.js";
import { unwrap } from "../utils.js";

export const usernameProcedures = {
  check: authed
    .input(z.object({ username: z.string() }))
    .handler(async ({ context, input }) => {
      const result = await userService.checkUsernameAvailable(
        context.userId!,
        input.username,
      );
      if (!result.success) {
        return { available: false };
      }
      return { available: result.data };
    }),

  update: authed
    .input(z.object({ username: z.string() }))
    .handler(async ({ context, input }) => {
      unwrap(await userService.updateUsername(context.userId!, input.username));
      return {};
    }),
};
