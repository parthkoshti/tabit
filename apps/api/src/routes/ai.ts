import { Hono } from "hono";
import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { db, tab, tabMember, user } from "db";
import { eq, and, ne, inArray } from "drizzle-orm";
import { createExpenseAddedNotificationPayload } from "models";
import type { AuthContext } from "../auth.js";
import { authMiddleware } from "../auth.js";
import { expense, tab as tabData } from "data";
import { publishNotification } from "../lib/redis.js";
import { log } from "../lib/logger.js";

function roundTo2(n: number) {
  return Math.round(n * 100) / 100;
}

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
    db
      .select({ name: user.name, username: user.username })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
      .then((r) => r[0]),
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

    const parsedExpense = {
      ...output,
      description: formatDescription(output.description),
    };

    const [member] = await db
      .select()
      .from(tabMember)
      .where(
        and(
          eq(tabMember.tabId, parsedExpense.tabId),
          eq(tabMember.userId, userId),
        ),
      )
      .limit(1);

    if (!member) {
      return c.json(
        {
          success: false,
          error: "Could not resolve tab. Please specify which friend or tab.",
        },
        400,
      );
    }

    const [payerIsMember] = await db
      .select()
      .from(tabMember)
      .where(
        and(
          eq(tabMember.tabId, parsedExpense.tabId),
          eq(tabMember.userId, parsedExpense.paidById),
        ),
      )
      .limit(1);

    if (!payerIsMember) {
      return c.json(
        { success: false, error: "Payer must be a member of the tab" },
        400,
      );
    }

    const allMembers = await db
      .select()
      .from(tabMember)
      .where(eq(tabMember.tabId, parsedExpense.tabId));

    const participantIds =
      parsedExpense.participantIds && parsedExpense.participantIds.length > 0
        ? parsedExpense.participantIds
        : allMembers.map((m) => m.userId);
    const members = allMembers.filter((m) => participantIds.includes(m.userId));

    if (members.length < 1) {
      return c.json(
        { success: false, error: "At least one person must be in the split" },
        400,
      );
    }

    if (members.length === 1 && members[0].userId === parsedExpense.paidById) {
      return c.json(
        {
          success: false,
          error: "Payer cannot be the only member of the split",
        },
        400,
      );
    }

    const amount = parsedExpense.amount;
    const perPerson = Math.floor((amount / members.length) * 100) / 100;
    const remainder = roundTo2(amount - perPerson * (members.length - 1));
    const splits = members.map((m, i) => ({
      userId: m.userId,
      amount: i === members.length - 1 ? remainder : perPerson,
    }));

    const expenseId = await expense.create({
      tabId: parsedExpense.tabId,
      paidById: parsedExpense.paidById,
      amount: parsedExpense.amount,
      description: parsedExpense.description,
      splitType: "equal",
      expenseDate: new Date(),
      splits,
      performedById: userId,
    });

    const [tabRow] = await db
      .select({ name: tab.name, isDirect: tab.isDirect, currency: tab.currency })
      .from(tab)
      .where(eq(tab.id, parsedExpense.tabId))
      .limit(1);

    let tabDisplayName = tabRow?.name ?? "Tab";
    if (tabRow?.isDirect) {
      const [otherUser] = await db
        .select({ name: user.name, username: user.username })
        .from(tabMember)
        .innerJoin(user, eq(tabMember.userId, user.id))
        .where(
          and(
            eq(tabMember.tabId, parsedExpense.tabId),
            ne(tabMember.userId, userId),
          ),
        )
        .limit(1);
      if (otherUser) {
        tabDisplayName =
          otherUser.name ??
          (otherUser.username ? `@${otherUser.username}` : null) ??
          tabDisplayName;
      }
    }

    const [fromUser] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const splitByUser = new Map(splits.map((s) => [s.userId, s.amount]));
    const recipientCount = members.filter((m) => m.userId !== userId).length;
    for (const m of members) {
      if (m.userId !== userId) {
        const recipientOweAmount = splitByUser.get(m.userId)?.toString();
        const payload = createExpenseAddedNotificationPayload({
          tabId: parsedExpense.tabId,
          expenseId,
          tabName: tabRow?.name ?? "Tab",
          isDirect: tabRow?.isDirect ?? false,
          fromUserId: userId,
          fromUserName: fromUser?.name ?? null,
          description: parsedExpense.description,
          amount: parsedExpense.amount.toString(),
          recipientOweAmount,
          createdAt: new Date(),
        });
        await publishNotification(m.userId, payload);
      }
    }

    log("info", "AI expense created", {
      userId,
      tabId: parsedExpense.tabId,
      expenseId,
      amount: parsedExpense.amount,
      recipientCount,
    });

    const participantUserRows =
      participantIds.length > 0
        ? await db
            .select({ id: user.id, name: user.name, username: user.username })
            .from(user)
            .where(inArray(user.id, participantIds))
        : [];
    const participantMap = new Map(
      participantUserRows.map((r) => [
        r.id,
        { userId: r.id, name: r.name, username: r.username },
      ]),
    );
    const participants = participantIds
      .map((id) => participantMap.get(id))
      .filter(Boolean)
      .map((p) => {
        const share = splitByUser.get(p!.userId) ?? 0;
        const isPayer = p!.userId === parsedExpense.paidById;
        return {
          userId: p!.userId,
          name: p!.name ?? (p!.username ? `@${p!.username}` : null),
          paid: isPayer ? amount : undefined,
          owes: !isPayer ? share : undefined,
        };
      });

    return c.json({
      success: true,
      expenseId,
      amount: parsedExpense.amount,
      description: parsedExpense.description,
      tabName: tabDisplayName,
      tabId: parsedExpense.tabId,
      currency: tabRow?.currency ?? "USD",
      participants,
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
