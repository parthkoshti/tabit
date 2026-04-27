import { DateTime } from "luxon";
import {
  createRecurringExpenseRuleSchema,
  updateRecurringExpenseRuleSchema,
  recurringScheduleSchema,
  recurringExpenseTemplateSchema,
} from "models";
import { recurringExpense, tab, user as userData } from "data";
import type { RecurringRuleRow } from "data";
import { ok, err, type Result } from "./types.js";
import { expenseService } from "./expense.js";
import { notificationService } from "./notification.js";
import {
  resolveIanaZone,
  listOccurrenceKeysInRange,
  nextScheduleKeyAfter,
  firstScheduleKeyOnOrAfter,
  occurrenceKeyToExpenseDate,
  dateKeyCompare,
  SENTINEL_DONE,
} from "./recurring-schedule.js";
import type { CreateExpenseInput } from "./expense.js";

async function tabDisplayNameForOwner(tabId: string, ownerUserId: string): Promise<string> {
  const info = await tab.getTabInfoForNotifications(tabId, ownerUserId);
  return info?.name ?? "Tab";
}

export const recurringExpenseService = {
  async listForTab(tabId: string, userId: string): Promise<Result<RecurringRuleRow[]>> {
    const isMember = await tab.isMember(tabId, userId);
    if (!isMember) return err("Not a member", 403);
    const rows = await recurringExpense.listByTabId(tabId);
    return ok(rows);
  },

  async getById(
    ruleId: string,
    userId: string,
  ): Promise<Result<RecurringRuleRow>> {
    const rule = await recurringExpense.getById(ruleId);
    if (!rule) return err("Rule not found", 404);
    const isMember = await tab.isMember(rule.tabId, userId);
    if (!isMember) return err("Not a member", 403);
    return ok(rule);
  },

  async create(
    tabId: string,
    ownerUserId: string,
    body: unknown,
  ): Promise<Result<{ ruleId: string }>> {
    const parsed = createRecurringExpenseRuleSchema.safeParse(body);
    if (!parsed.success) {
      return err(parsed.error.flatten().formErrors[0] ?? "Invalid", 400);
    }
    const isMember = await tab.isMember(tabId, ownerUserId);
    if (!isMember) return err("Not a member", 403);

    const owner = await userData.getById(ownerUserId);
    const zone = resolveIanaZone(owner?.timezone);
    const schedule = recurringScheduleSchema.parse(parsed.data.schedule);
    const template = recurringExpenseTemplateSchema.parse(parsed.data.template);

    const nextDueKey = firstScheduleKeyOnOrAfter(
      schedule,
      parsed.data.startsOn,
      zone,
    );

    const id = await recurringExpense.insertRule({
      tabId,
      ownerUserId,
      status: "active",
      schedule,
      template,
      startsOn: parsed.data.startsOn,
      endsOn: parsed.data.endsOn ?? null,
      maxCount: parsed.data.maxCount ?? null,
      postedCount: 0,
      nextDueKey,
    });

    return ok({ ruleId: id });
  },

  async update(
    ruleId: string,
    userId: string,
    body: unknown,
  ): Promise<Result<void>> {
    const rule = await recurringExpense.getById(ruleId);
    if (!rule) return err("Rule not found", 404);
    if (rule.ownerUserId !== userId) return err("Forbidden", 403);

    const parsed = updateRecurringExpenseRuleSchema.safeParse(body);
    if (!parsed.success) {
      return err(parsed.error.flatten().formErrors[0] ?? "Invalid", 400);
    }
    const p = parsed.data;
    const owner = await userData.getById(rule.ownerUserId);
    const zone = resolveIanaZone(owner?.timezone);

    const patch: Parameters<typeof recurringExpense.updateRule>[1] = {};
    if (p.status !== undefined) {
      patch.status = p.status;
      patch.pausedAt =
        p.status === "active"
          ? null
          : p.status === "paused_user" || p.status === "paused_needs_fix"
            ? new Date()
            : null;
    }
    if (p.startsOn !== undefined) patch.startsOn = p.startsOn;
    if (p.endsOn !== undefined) patch.endsOn = p.endsOn;
    if (p.maxCount !== undefined) patch.maxCount = p.maxCount;
    if (p.schedule !== undefined) {
      patch.schedule = recurringScheduleSchema.parse(p.schedule);
    }
    if (p.template !== undefined) {
      patch.template = recurringExpenseTemplateSchema.parse(p.template);
    }

    if (p.schedule !== undefined || p.startsOn !== undefined) {
      const schedule = recurringScheduleSchema.parse(
        p.schedule ?? (rule.schedule as object),
      );
      const startsOn = p.startsOn ?? rule.startsOn;
      patch.nextDueKey = firstScheduleKeyOnOrAfter(schedule, startsOn, zone);
    }

    await recurringExpense.updateRule(ruleId, patch);
    return ok(undefined);
  },

  async deleteRule(ruleId: string, userId: string): Promise<Result<void>> {
    const rule = await recurringExpense.getById(ruleId);
    if (!rule) return err("Rule not found", 404);
    if (rule.ownerUserId !== userId) return err("Forbidden", 403);
    if (rule.postedCount > 0) {
      return err("Cannot delete a rule that has already posted expenses", 400);
    }
    await recurringExpense.deleteRule(ruleId);
    return ok(undefined);
  },

  async runTick(): Promise<void> {
    const rules = await recurringExpense.listAllActiveRules();
    for (const rule of rules) {
      const owner = await userData.getById(rule.ownerUserId);
      const zone = resolveIanaZone(owner?.timezone);
      const todayKey = DateTime.now().setZone(zone).toFormat("yyyy-LL-dd");

      if (dateKeyCompare(rule.nextDueKey, todayKey) > 0) continue;
      if (dateKeyCompare(rule.startsOn, todayKey) > 0) continue;

      const scheduleParse = recurringScheduleSchema.safeParse(rule.schedule);
      const templateParse = recurringExpenseTemplateSchema.safeParse(rule.template);
      if (!scheduleParse.success || !templateParse.success) {
        await recurringExpense.updateRule(rule.id, {
          status: "paused_needs_fix",
          pausedAt: new Date(),
        });
        const tabName = await tabDisplayNameForOwner(rule.tabId, rule.ownerUserId);
        await notificationService.publishRecurringRuleNeedsFixToUser(rule.ownerUserId, {
          ruleId: rule.id,
          tabId: rule.tabId,
          tabName,
          reason: "validation_failed",
          editRulePath: `/expense/recurring/${rule.id}`,
          createdAt: new Date(),
        });
        continue;
      }

      const schedule = scheduleParse.data;
      const tpl = templateParse.data;

      const toKey =
        rule.endsOn != null && dateKeyCompare(rule.endsOn, todayKey) < 0 ? rule.endsOn : todayKey;

      const keys = listOccurrenceKeysInRange(schedule, rule.nextDueKey, toKey, zone);
      if (keys.length === 0) {
        if (dateKeyCompare(rule.nextDueKey, todayKey) <= 0) {
          await recurringExpense.updateRule(rule.id, { nextDueKey: SENTINEL_DONE });
        }
        continue;
      }

      let posted = rule.postedCount;
      let lastHandled: string | null = null;

      for (const key of keys) {
        if (rule.maxCount != null && posted >= rule.maxCount) break;
        if (rule.endsOn != null && dateKeyCompare(key, rule.endsOn) > 0) break;

        const expenseDate = occurrenceKeyToExpenseDate(key, zone);
        const input: CreateExpenseInput = {
          tabId: rule.tabId,
          paidById: tpl.paidById,
          amount: tpl.amount,
          currency: tpl.currency,
          description: tpl.description,
          splitType: tpl.splitType,
          expenseDate,
          participantIds: tpl.participantIds,
          splits: tpl.splits,
        };

        const r = await expenseService.postRecurringOccurrence(
          rule.id,
          key,
          tpl.description,
          rule.ownerUserId,
          input,
        );

        if (!r.success) {
          await recurringExpense.updateRule(rule.id, {
            status: "paused_needs_fix",
            pausedAt: new Date(),
          });
          const tabName = await tabDisplayNameForOwner(rule.tabId, rule.ownerUserId);
          await notificationService.publishRecurringRuleNeedsFixToUser(rule.ownerUserId, {
            ruleId: rule.id,
            tabId: rule.tabId,
            tabName,
            reason: "validation_failed",
            editRulePath: `/expense/recurring/${rule.id}`,
            createdAt: new Date(),
          });
          break;
        }

        if (r.data.created) posted++;
        lastHandled = key;
      }

      if (lastHandled != null) {
        const next = nextScheduleKeyAfter(schedule, lastHandled, zone, rule.endsOn);
        await recurringExpense.updateRule(rule.id, {
          postedCount: posted,
          nextDueKey: next,
        });
      }
    }
  },
};
