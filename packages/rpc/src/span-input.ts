import { setSpanAttributes } from "otel";

function readString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Sets semantic span attributes from common oRPC procedure inputs.
 */
export function annotateSpanFromInput(input: unknown): void {
  if (input == null || typeof input !== "object") return;

  const obj = input as Record<string, unknown>;
  const attrs: Record<string, string> = {};

  const tabId = readString(obj, "tabId");
  if (tabId) attrs["tab.id"] = tabId;

  const expenseId = readString(obj, "expenseId");
  if (expenseId) attrs["expense.id"] = expenseId;

  const settlementId = readString(obj, "settlementId");
  if (settlementId) attrs["settlement.id"] = settlementId;

  const ruleId = readString(obj, "ruleId");
  if (ruleId) attrs["recurring_rule.id"] = ruleId;

  const requestId = readString(obj, "requestId");
  if (requestId) attrs["request.id"] = requestId;

  const targetUserId = readString(obj, "userId");
  if (targetUserId) attrs["target.user.id"] = targetUserId;

  const participantId = readString(obj, "participantId");
  if (participantId) attrs["participant.id"] = participantId;

  if (Object.keys(attrs).length > 0) {
    setSpanAttributes(attrs);
  }
}

export function tabIdFromInput(input: unknown): string | undefined {
  if (input == null || typeof input !== "object") return undefined;
  return readString(input as Record<string, unknown>, "tabId");
}
