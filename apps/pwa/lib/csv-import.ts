import Papa from "papaparse";
import { parse, isValid, format } from "date-fns";

/**
 * Splitwise CSV export format. Columns (order may vary, matched by name):
 * - Date, Description, Category, Cost, Currency
 * - One column per person (header = person name, or "Net balance (Person Name)")
 * - Per-person net balance = Paid - Owe: positive = paid (gets back), negative = owes
 * - Dates are in user's local timezone
 */
const SPLITWISE_FIXED_COLUMNS = [
  "date",
  "description",
  "category",
  "cost",
  "currency",
];

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function findColumnIndex(headers: unknown[], name: string): number {
  const normalized = name.toLowerCase();
  return headers.findIndex(
    (h) => normalizeHeader(String(h ?? "")) === normalized,
  );
}

function parseNumber(value: string): number | null {
  const cleaned = value.trim().replace(/,/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

const DATE_FORMATS = [
  "yyyy-MM-dd",
  "MM/dd/yyyy",
  "dd-MM-yyyy",
  "dd/MM/yyyy",
  "M/d/yyyy",
  "d/M/yyyy",
];

/**
 * Parse date string. Splitwise dates are in user's local timezone (e.g. 2024-04-15).
 * date-fns parse() returns a Date at local midnight.
 */
function parseDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  for (const fmt of DATE_FORMATS) {
    const d = parse(trimmed, fmt, new Date());
    if (isValid(d)) return d;
  }
  return null;
}

/**
 * Format date as YYYY-MM-DD in local timezone. Do NOT use toISOString() which
 * converts to UTC and can shift the date (e.g. 2024-04-15 local -> 2024-04-14 UTC).
 */
export function formatDateLocal(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Splitwise member columns may be "Net balance (Person Name)" or just "Person Name".
 * Strip prefix for cleaner display. Returns cleaned name or original if no match.
 */
export function getMemberColumnDisplayName(header: string): string {
  const match = header.match(/^Net balance\s*[,(]\s*(.+?)\s*\)?\s*$/i);
  return match ? match[1].trim() : header;
}

function normalizeForMatch(s: string): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ").replace(/\s/g, "");
}

/**
 * Auto-match CSV member column headers to tab members by name and username.
 * Returns columnHeader -> userId mapping for columns that match.
 */
export function autoMatchMemberColumns(
  memberColumns: string[],
  members: Array<{
    userId: string;
    user: { name?: string | null; username?: string | null };
  }>,
): Record<string, string> {
  const result: Record<string, string> = {};
  const matchedMemberIds = new Set<string>();

  console.log("[Import CSV] autoMatchMemberColumns", memberColumns, members);

  for (const col of memberColumns) {
    const displayName = getMemberColumnDisplayName(col);
    const colNorm = normalizeForMatch(displayName);
    if (!colNorm) continue;

    for (const m of members) {
      if (matchedMemberIds.has(m.userId)) continue;

      const nameNorm = normalizeForMatch(m.user.name ?? "");
      const usernameNorm = normalizeForMatch(m.user.username ?? "").replace(
        /^@/,
        "",
      );

      const matches =
        (nameNorm && colNorm === nameNorm) ||
        (usernameNorm && colNorm === usernameNorm);

      if (matches) {
        result[col] = m.userId;
        matchedMemberIds.add(m.userId);
        break;
      }
    }
  }

  console.log("[Import CSV] autoMatchMemberColumns", result);

  return result;
}

export type ParsedCsvRow = {
  date: Date | null;
  description: string;
  cost: number;
  memberAmounts: Record<string, number>;
  rowIndex: number;
};

export type ParsedCsv = {
  memberColumns: string[];
  rows: ParsedCsvRow[];
  errors: string[];
};

export function parseCsvFile(content: string): ParsedCsv {
  const result = Papa.parse<string[]>(content, { skipEmptyLines: true });
  const errors: string[] = [];

  if (result.errors.length > 0) {
    errors.push(
      ...result.errors.map(
        (e: { message?: string }) => e.message ?? "Parse error",
      ),
    );
  }

  const rows = result.data;
  if (rows.length < 2) {
    return {
      memberColumns: [],
      rows: [],
      errors: ["CSV must have a header row and at least one data row"],
    };
  }

  const rawHeaders = rows[0] ?? [];
  if (!Array.isArray(rawHeaders)) {
    return { memberColumns: [], rows: [], errors: ["Invalid CSV format"] };
  }

  const dateIdx = findColumnIndex(rawHeaders, "date");
  const descIdx = findColumnIndex(rawHeaders, "description");
  const costIdx = findColumnIndex(rawHeaders, "cost");

  if (dateIdx < 0) errors.push("Missing 'Date' column");
  if (descIdx < 0) errors.push("Missing 'Description' column");
  if (costIdx < 0) errors.push("Missing 'Cost' column");

  const memberColumnIndices: { index: number; header: string }[] = [];
  for (let i = 0; i < rawHeaders.length; i++) {
    const raw = String(rawHeaders[i] ?? "").trim();
    const h = normalizeHeader(raw);
    if (!SPLITWISE_FIXED_COLUMNS.includes(h)) {
      memberColumnIndices.push({ index: i, header: raw || `Column ${i + 1}` });
    }
  }

  const memberColumns = memberColumnIndices.map((c) => c.header);
  const parsedRows: ParsedCsvRow[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (!cells || cells.every((c: unknown) => !String(c ?? "").trim()))
      continue;

    const dateVal = dateIdx >= 0 ? cells[dateIdx] : "";
    const descVal = descIdx >= 0 ? String(cells[descIdx] ?? "").trim() : "";
    const costVal =
      costIdx >= 0 ? parseNumber(String(cells[costIdx] ?? "")) : null;

    if (descVal.toLowerCase() === "total balance") continue;

    const memberAmounts: Record<string, number> = {};
    for (const { index, header } of memberColumnIndices) {
      const val =
        index < cells.length ? parseNumber(String(cells[index] ?? "")) : null;
      memberAmounts[header] = val ?? 0;
    }

    parsedRows.push({
      date: parseDate(dateVal),
      description: descVal,
      cost: costVal ?? 0,
      memberAmounts,
      rowIndex: r + 1,
    });
  }

  return { memberColumns, rows: parsedRows, errors };
}

export type RowValidation = {
  valid: boolean;
  error?: string;
  payerUserId?: string;
  splits?: { userId: string; amount: number }[];
};

export function validateRow(
  row: ParsedCsvRow,
  columnToUserId: Record<string, string>,
  defaultPayerId: string,
): RowValidation {
  if (row.cost <= 0) {
    return { valid: false, error: "Cost must be positive" };
  }

  if (!row.description) {
    return { valid: false, error: "Description is required" };
  }

  const aggregatedByUser: Record<string, number> = {};
  for (const [colHeader, amount] of Object.entries(row.memberAmounts)) {
    const userId = columnToUserId[colHeader];
    if (!userId || amount === 0) continue;
    aggregatedByUser[userId] = (aggregatedByUser[userId] ?? 0) + amount;
  }

  // Splitwise net = Paid - Owe: positive = paid (gets back), negative = owes
  const payers = Object.entries(aggregatedByUser).filter(([, amt]) => amt > 0);
  const owees = Object.entries(aggregatedByUser).filter(([, amt]) => amt < 0);

  if (payers.length === 0) {
    return {
      valid: false,
      error: "No payer (need at least one positive amount)",
    };
  }

  if (payers.length > 1) {
    return {
      valid: false,
      error: "Multiple payers not supported (only one positive amount allowed)",
    };
  }

  const payerId = payers[0][0];
  const payerNet = payers[0][1];
  const payerShare = Math.round((row.cost - payerNet) * 100) / 100;
  const splits: { userId: string; amount: number }[] = [];

  for (const [userId, amount] of Object.entries(aggregatedByUser)) {
    if (amount > 0) {
      splits.push({ userId, amount: payerShare });
    } else if (amount < 0) {
      splits.push({
        userId,
        amount: Math.round(Math.abs(amount) * 100) / 100,
      });
    }
  }

  const sumSplits = splits.reduce((s, x) => s + x.amount, 0);
  const diff = Math.abs(sumSplits - row.cost);
  if (diff > 0.01) {
    return {
      valid: false,
      error: `Split sum (${sumSplits.toFixed(2)}) does not match cost (${row.cost.toFixed(2)})`,
    };
  }

  if (splits.length < 2) {
    return { valid: false, error: "At least two participants required" };
  }

  const participantIds = new Set(splits.map((s) => s.userId));
  if (participantIds.size === 1) {
    return { valid: false, error: "Payer cannot be the only participant" };
  }

  return { valid: true, payerUserId: payerId, splits };
}

export function buildExpensePayload(
  row: ParsedCsvRow,
  validation: RowValidation,
  defaultPayerId: string,
): {
  amount: number;
  description: string;
  paidById: string;
  splitType: "custom";
  splits: { userId: string; amount: number }[];
  expenseDate: string;
} {
  const payerId = validation.payerUserId ?? defaultPayerId;
  const splits = validation.splits ?? [];

  return {
    amount: Math.round(row.cost * 100) / 100,
    description: row.description,
    paidById: payerId,
    splitType: "custom",
    splits,
    expenseDate: row.date
      ? formatDateLocal(row.date)
      : formatDateLocal(new Date()),
  };
}
