import { z } from "zod";
import { isAddExpensePreference } from "models";
import { userService } from "services";
import { authed } from "../auth-middleware.js";
import { unwrap } from "../utils.js";
import { resolveSuggestedTimezoneForRequest } from "../request-timezone.js";

const preferencesUpdateSchema = z.object({
  addExpensePreference: z.enum(["ai", "manual"]).nullable().optional(),
  timezone: z.string().nullable().optional(),
});

export const preferencesProcedures = {
  get: authed.handler(async ({ context }) => {
    const result = await userService.getPreferences(context.userId!);
    const suggestedTimezoneFromRequest = await resolveSuggestedTimezoneForRequest(
      context.headers,
    );
    return {
      ...result.data,
      suggestedTimezoneFromRequest,
    };
  }),

  update: authed
    .input(preferencesUpdateSchema)
    .handler(async ({ context, input }) => {
      const updates: {
        addExpensePreference?: "ai" | "manual" | null;
        timezone?: string | null;
      } = {};
      if ("addExpensePreference" in input) {
        const val = input.addExpensePreference;
        updates.addExpensePreference =
          val === null || val === undefined
            ? null
            : isAddExpensePreference(val)
              ? val
              : null;
      }
      if ("timezone" in input) {
        const tz = input.timezone;
        updates.timezone =
          tz === null || tz === undefined
            ? null
            : typeof tz === "string"
              ? tz.trim() || null
              : null;
      }

      if (Object.keys(updates).length === 0) {
        return {};
      }

      if ("timezone" in updates) {
        unwrap(
          await userService.updateProfile(context.userId!, {
            timezone: updates.timezone,
          }),
        );
        delete updates.timezone;
      }

      if (Object.keys(updates).length > 0) {
        await userService.updatePreferences(context.userId!, updates);
      }
      return {};
    }),
};
