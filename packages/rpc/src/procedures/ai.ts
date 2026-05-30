import { z } from "zod";
import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { tab as tabData, user as userData } from "data";
import { expenseService } from "services";
import { authed } from "../auth-middleware.js";
import { ORPCError } from "@orpc/server";
import { unwrap } from "../utils.js";

function formatDescription(description: string): string {
  return description
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) =>
      word.length > 0
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : word,
    )
    .join(" ");
}

const parsedExpenseSchema = z.object({
  tabId: z.string(),
  amount: z.number().positive(),
  description: z.string().min(1),
  paidById: z.string(),
  participantIds: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  ambiguityReason: z.string().optional(),
});

export const aiProcedures = {
  addExpense: authed
    .input(z.object({ text: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const userId = context.userId!;

      const [friends, tabs, currentUserRow] = await Promise.all([
        tabData.getDirectTabsForUser(userId),
        tabData.getTabsForUser(userId, {
          includeDirect: false,
          includeMemberIds: true,
        }),
        userData.getById(userId),
      ]);

      type TabContext = {
        tabId: string;
        label: string;
        members: Array<{
          userId: string;
          name: string | null;
          username: string | null;
        }>;
      };

      const tabContexts: TabContext[] = [];

      for (const f of friends ?? []) {
        tabContexts.push({
          tabId: f.id,
          label: `Friend: ${f.friend.name ?? f.friend.username ?? "Unknown"}`,
          members: [
            {
              userId,
              name: currentUserRow?.name ?? null,
              username: currentUserRow?.username ?? null,
            },
            {
              userId: f.friend.id,
              name: f.friend.name,
              username: f.friend.username,
            },
          ],
        });
      }

      for (const t of tabs ?? []) {
        const tabWithMembers = await tabData.getWithMembers(t.id);
        if (tabWithMembers && tabWithMembers.members.length > 0) {
          tabContexts.push({
            tabId: t.id,
            label: `Tab: ${t.name}`,
            members: tabWithMembers.members.map((m) => ({
              userId: m.userId,
              name: m.user.name,
              username: m.user.username,
            })),
          });
        }
      }

      if (tabContexts.length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Add a friend or create a tab first to add expenses.",
        });
      }

      const contextParts = tabContexts.map(
        (tc) =>
          `${tc.label}\n` +
          `tabId: "${tc.tabId}"\n` +
          `Members (use userId for paidById and participantIds):\n` +
          tc.members
            .map(
              (m) =>
                `  - userId: "${m.userId}", name: ${m.name ?? "null"}, username: ${m.username ? `@${m.username}` : "null"}`,
            )
            .join("\n"),
      );

      const systemPrompt = `You are an expense parsing assistant. Extract expense details from the user's natural language and return structured data. Do NOT guess or make up values when the input is ambiguous.

Current user ID (use for "I paid" or when payer is not specified): ${userId}

Available tabs with members (match tab by label, match people by name or username for paidById/participantIds):

${contextParts.join("\n\n")}

Select the tabId from the lists above. Match "with John" to a friend tab, "in Paris trip" to a group tab. For paidById, use the userId of the person who paid - match by name (e.g. "John paid" -> find John's userId). You MUST pick a tabId from the provided list.

Rules:
- Extract amount in dollars (number). If user says "$50" or "50 dollars", use 50.
- Extract a clear description (e.g. "dinner at the restaurant").
- paidById: Use the userId of the person who paid. When the user explicitly names a payer (e.g. "John paid", "Sarah paid"), use that person's userId. When NO payer is explicitly mentioned, ALWAYS use the current user: ${userId}.
- participantIds: omit for equal split among all members, or provide user IDs to include in split.

CRITICAL - Confidence and ambiguity:
- confidence: 0.0 to 1.0. Use 1.0 only when amount, tab, and participants are clear. When payer is not specified, using current user ${userId} is correct and does NOT reduce confidence.
- Use 0.5 or lower when: multiple tabs could match (e.g. user has two friends named John), amount is unclear, or you had to guess.
- Use 0.3 or lower when: you had to infer or assume critical fields (tab, amount). Defaulting to current user when payer is unspecified is NOT an assumption that reduces confidence.
- ambiguityReason: when confidence < 0.8, briefly explain what is unclear (e.g. "Multiple tabs match 'John'", "Amount not specified"). Never cite "unclear who paid" when the user simply did not mention a payer - in that case use current user.`;

      const userPrompt = `Parse this expense: "${input.text}"`;

      try {
        const { output } = await generateText({
          model: google("gemini-2.5-flash-lite"),
          system: systemPrompt,
          prompt: userPrompt,
          output: Output.object({
            schema: parsedExpenseSchema,
          }),
        });

        const CONFIDENCE_THRESHOLD = 0.8;
        if (output.confidence < CONFIDENCE_THRESHOLD) {
          const reason =
            output.ambiguityReason ??
            "Input is ambiguous. Please specify amount, which tab, and who paid.";
          throw new ORPCError("BAD_REQUEST", { message: reason });
        }

        const data = unwrap(
          await expenseService.create(
            {
              tabId: output.tabId,
              paidById: output.paidById,
              amount: output.amount,
              description: formatDescription(output.description),
              splitType: "equal",
              expenseDate: new Date(),
              participantIds: output.participantIds,
            },
            userId,
          ),
        );

        return {
          expenseId: data.expenseId,
          amount: data.amount,
          description: data.description,
          tabName: data.tabName,
          tabId: data.tabId,
          currency: data.currency,
          participants: data.participants,
        };
      } catch (err) {
        if (err instanceof ORPCError) throw err;
        const errMsg = err instanceof Error ? err.message : String(err);
        if (
          errMsg.includes("NoObjectGeneratedError") ||
          errMsg.includes("No object generated")
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message:
              "Please include amount and description (e.g. 50 dinner with Sam at Olive Garden).",
          });
        }
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Failed to parse expense. Please try again.",
        });
      }
    }),
};
