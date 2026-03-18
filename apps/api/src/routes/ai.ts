import { Hono } from "hono";
import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";
import { tab as tabData, user as userData } from "data";
import { expenseService } from "services";
import { log } from "../lib/logger.js";

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

const aiAddExpenseSchema = z.object({
  text: z.string().min(1),
});

const parsedExpenseSchema = z.object({
  tabId: z.string(),
  amount: z.number().positive(),
  description: z.string().min(1),
  paidById: z.string(),
  participantIds: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  ambiguityReason: z.string().optional(),
});

export const aiRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

aiRoutes.use("*", authMiddleware);

aiRoutes.post("/add-expense", async (c) => {
  const { userId } = c.get("auth");

  const body = await c.req.json().catch(() => ({}));
  const parsed = aiAddExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, error: parsed.error.flatten().formErrors[0] },
      400,
    );
  }

  const { text } = parsed.data;

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
    return c.json(
      {
        success: false,
        error: "Add a friend or create a tab first to add expenses.",
      },
      400,
    );
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
- paidById must be a valid userId from the members list. When user says "I paid", use ${userId}.
- participantIds: omit for equal split among all members, or provide user IDs to include in split.

CRITICAL - Confidence and ambiguity:
- confidence: 0.0 to 1.0. Use 1.0 only when amount, tab, payer, and participants are all clearly specified and unambiguous.
- Use 0.5 or lower when: multiple tabs could match (e.g. user has two friends named John), amount is unclear, payer is ambiguous, or you had to guess.
- Use 0.3 or lower when: you had to infer or assume critical fields (tab, payer, amount).
- ambiguityReason: when confidence < 0.8, briefly explain what is unclear (e.g. "Multiple tabs match 'John'", "Amount not specified", "Unclear who paid").`;

  const userPrompt = `Parse this expense: "${text}"`;

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
      return c.json(
        {
          success: false,
          error: reason,
        },
        400,
      );
    }

    const result = await expenseService.create(
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
    );

    if (!result.success) {
      return c.json(
        { success: false, error: result.error },
        result.status as 400 | 403 | 404,
      );
    }

    log("info", "AI expense created", {
      userId,
      tabId: result.data.tabId,
      expenseId: result.data.expenseId,
      amount: result.data.amount,
    });

    return c.json({
      success: true,
      expenseId: result.data.expenseId,
      amount: result.data.amount,
      description: result.data.description,
      tabName: result.data.tabName,
      tabId: result.data.tabId,
      currency: result.data.currency,
      participants: result.data.participants,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (
      errMsg.includes("NoObjectGeneratedError") ||
      errMsg.includes("No object generated")
    ) {
      return c.json(
        {
          success: false,
          error:
            "Please include amount and description (e.g. 50 dinner with Sam at Olive Garden).",
        },
        400,
      );
    }
    log("error", "AI add expense failed", { error: errMsg });
    return c.json(
      {
        success: false,
        error: "Failed to parse expense. Please try again.",
      },
      500,
    );
  }
});
