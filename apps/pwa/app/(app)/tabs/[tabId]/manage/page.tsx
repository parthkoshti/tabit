"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTab, fetchExpenses } from "@/app/actions/queries";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { Link as TransitionLink } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useNavTitle } from "../../../context/nav-title-context";
import {
  parseCsvFile,
  validateRow,
  buildExpensePayload,
  getMemberColumnDisplayName,
  formatDateLocal,
  autoMatchMemberColumns,
  type ParsedCsv,
  type ParsedCsvRow,
} from "@/lib/csv-import";
import { format } from "date-fns";
import { Upload, FileSpreadsheet } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";

export default function ManageTabPage() {
  const params = useParams<{ tabId: string }>();
  const tabId = params.tabId;
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const setNavTitle = useNavTitle();

  const { data: tab, isLoading: tabLoading } = useQuery({
    queryKey: ["tab", tabId],
    queryFn: () => fetchTab(tabId),
    enabled: !!tabId,
  });

  const currentUserId = session?.user?.id ?? "";
  const isAdmin =
    tab?.members?.find((m) => m.userId === currentUserId)?.role === "owner";

  useEffect(() => {
    setNavTitle?.({
      title: "Manage tab",
      backHref: `/tabs/${tabId}`,
    });
    return () => setNavTitle?.(null);
  }, [setNavTitle, tabId]);

  if (!tabId) return null;

  if (tabLoading || !tab) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-4">
        <Spinner />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-4">
        <div className="mx-auto max-w-md">
          <Alert variant="destructive">
            <AlertDescription>
              Only the tab admin can manage this tab.
            </AlertDescription>
          </Alert>
          <Button variant="outline" className="mt-4" asChild>
            <TransitionLink href={`/tabs/${tabId}`}>Back to tab</TransitionLink>
          </Button>
        </div>
      </div>
    );
  }

  if (tab.isDirect) {
    return (
      <div className="p-4">
        <div className="mx-auto max-w-md">
          <Alert variant="destructive">
            <AlertDescription>Direct tabs cannot be renamed.</AlertDescription>
          </Alert>
          <Button variant="outline" className="mt-4" asChild>
            <TransitionLink href={`/tabs/${tabId}`}>Back to tab</TransitionLink>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mx-auto max-w-md space-y-6 pb-26">
        <RenameTabForm
          tabId={tabId}
          currentName={tab.name}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["tab", tabId] });
            queryClient.invalidateQueries({ queryKey: ["tabs"] });
          }}
        />
        <ImportCsvForm
          tabId={tabId}
          members={tab.members}
          currentUserId={currentUserId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["tab", tabId] });
            queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
            queryClient.invalidateQueries({
              queryKey: ["expenses", tabId, "all"],
            });
            queryClient.invalidateQueries({ queryKey: ["balances", tabId] });
            queryClient.invalidateQueries({ queryKey: ["activity"] });
            queryClient.invalidateQueries({ queryKey: ["tabs"] });
          }}
        />
      </div>
    </div>
  );
}

function RenameTabForm({
  tabId,
  currentName,
  onSuccess,
}: {
  tabId: string;
  currentName: string;
  onSuccess?: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(currentName);
  }, [currentName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await api.tabs.update(tabId, name.trim());

    if (result.success) {
      toast.success("Tab renamed");
      onSuccess?.();
    } else {
      setError(result.error ?? "Failed to rename tab");
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rename tab</CardTitle>
        <CardDescription>
          Change the name of this tab. All members will see the new name.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tab name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Trip to NYC"
              required
              disabled={loading}
              autoComplete="off"
              maxLength={100}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button
            type="submit"
            disabled={loading || name.trim() === currentName}
          >
            {loading ? "Saving..." : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

type TabMember = {
  userId: string;
  role: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  };
};

function ImportCsvForm({
  tabId,
  members,
  currentUserId,
  onSuccess,
}: {
  tabId: string;
  members: TabMember[];
  currentUserId: string;
  onSuccess?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"upload" | "map" | "preview">("upload");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [columnToUserId, setColumnToUserId] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewFilter, setPreviewFilter] = useState<
    "all" | "duplicate" | "error"
  >("all");

  const { data: expensesResult } = useQuery({
    queryKey: ["expenses", tabId, "all"],
    queryFn: () => fetchExpenses(tabId),
    enabled: step === "preview" && !!tabId,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const existingExpenses = expensesResult?.expenses ?? [];

  function getDisplayName(m: TabMember): string {
    if (m.userId === currentUserId) return "You";
    return (
      m.user.name ?? (m.user.username ? `@${m.user.username}` : m.user.email)
    );
  }

  function formatAmount(n: number): string {
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const text = await file.text();
    const result = parseCsvFile(text);
    setParsed(result);
    if (result.errors.length > 0) {
      setError(result.errors.join(". "));
    } else if (result.rows.length === 0) {
      setError("No data rows found in CSV");
    } else {
      setColumnToUserId(autoMatchMemberColumns(result.memberColumns, members));
      setStep("map");
    }
    e.target.value = "";
  }

  function handleColumnMapping(columnHeader: string, userId: string) {
    setColumnToUserId((prev) => {
      const next = { ...prev };
      if (userId === "__skip__") {
        delete next[columnHeader];
      } else {
        next[columnHeader] = userId;
      }
      return next;
    });
  }

  function handleBackToUpload() {
    setStep("upload");
    setParsed(null);
    setColumnToUserId({});
    setError(null);
  }

  function handleBackToMap() {
    setStep("map");
    setError(null);
  }

  async function handlePreviewClick() {
    await queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
    setStep("preview");
  }

  const validRows = parsed
    ? parsed.rows.map((row) => ({
        row,
        validation: validateRow(row, columnToUserId, currentUserId),
      }))
    : [];

  const existingKeys = (() => {
    const set = new Set<string>();
    for (const e of existingExpenses ?? []) {
      const d = new Date(e.expenseDate);
      const amt = Math.round(Number(e.amount) * 100) / 100;
      const base = `${(e.description ?? "").trim()}|${amt.toFixed(2)}`;
      set.add(`${formatDateLocal(d)}|${base}`);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      set.add(`${formatDateLocal(nextDay)}|${base}`);
    }
    return set;
  })();

  function isDuplicate(row: ParsedCsvRow): boolean {
    const dateStr = row.date ? formatDateLocal(row.date) : "";
    const amt = Math.round(row.cost * 100) / 100;
    return existingKeys.has(
      `${dateStr}|${(row.description ?? "").trim()}|${amt.toFixed(2)}`,
    );
  }

  const sortedRows = [...validRows].sort((a, b) => {
    const da = a.row.date?.getTime() ?? 0;
    const db = b.row.date?.getTime() ?? 0;
    return db - da;
  });

  const filteredRows =
    previewFilter === "all"
      ? sortedRows
      : previewFilter === "duplicate"
        ? sortedRows.filter((r) => r.validation.valid && isDuplicate(r.row))
        : sortedRows.filter((r) => !r.validation.valid);

  const importableCount = validRows.filter(
    (r) => r.validation.valid && !isDuplicate(r.row),
  ).length;
  const duplicateCount = validRows.filter(
    (r) => r.validation.valid && isDuplicate(r.row),
  ).length;
  const errorCount = validRows.filter((r) => !r.validation.valid).length;

  const balanceByUser = (() => {
    const map: Record<string, number> = {};
    for (const { row, validation } of validRows) {
      if (
        !validation.valid ||
        !validation.splits ||
        !validation.payerUserId ||
        isDuplicate(row)
      )
        continue;
      const payerShare =
        validation.splits.find((s) => s.userId === validation.payerUserId)
          ?.amount ?? 0;
      for (const s of validation.splits) {
        const delta =
          s.userId === validation.payerUserId
            ? row.cost - payerShare
            : -s.amount;
        map[s.userId] = (map[s.userId] ?? 0) + delta;
      }
    }
    return map;
  })();

  async function handleImport() {
    if (!parsed || importableCount === 0) return;
    setLoading(true);
    setError(null);

    const expenses = validRows
      .filter((r) => r.validation.valid && !isDuplicate(r.row))
      .map(({ row, validation }) => {
        const payload = buildExpensePayload(row, validation, currentUserId);
        return {
          amount: payload.amount,
          description: payload.description,
          paidById: payload.paidById,
          splitType: "custom" as const,
          splits: payload.splits,
          expenseDate: payload.expenseDate,
          participantIds: Array.from(
            new Set(payload.splits.map((s) => s.userId)),
          ),
        };
      });

    const result = await api.expenses.createBulk(tabId, expenses);

    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Import failed");
      return;
    }
    if ((result.imported ?? 0) > 0) {
      toast.success(
        `Imported ${result.imported} expense${(result.imported ?? 0) !== 1 ? "s" : ""}`,
      );
      onSuccess?.();
      handleBackToUpload();
    }
    if ((result.failed ?? 0) > 0) {
      setError(
        `Failed to import ${result.failed} expense${(result.failed ?? 0) !== 1 ? "s" : ""}${result.errors?.length ? `: ${result.errors.slice(0, 3).join("; ")}` : ""}`,
      );
    }
  }

  const splitwiseExportUrl =
    "https://feedback.splitwise.com/knowledgebase/articles/88333-how-do-i-export-my-transactions-to-a-spreadsheet-o";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import from Splitwise</CardTitle>
        <CardDescription>
          Export a group/friend as spreadsheet from Splitwise, then upload the
          CSV.{" "}
          <a
            href={splitwiseExportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 text-foreground"
          >
            How to export from Splitwise
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileSelect}
        />

        {step === "upload" && (
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Choose CSV file
            </Button>
            <p className="text-xs text-muted-foreground">
              Splitwise format: Date, Description, Category, Cost, Currency,
              then one column per person (negative = paid, positive = owes).
            </p>
          </div>
        )}

        {step === "map" && parsed && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              {parsed.rows.length} row{parsed.rows.length !== 1 ? "s" : ""}{" "}
              found
            </div>
            <div className="space-y-2">
              <Label>Map member columns to tab members</Label>
              {parsed.memberColumns.map((col) => (
                <div key={col} className="flex items-center gap-2">
                  <span className="min-w-[100px] truncate text-sm" title={col}>
                    {getMemberColumnDisplayName(col)}
                  </span>
                  <Select
                    value={columnToUserId[col] ?? "__skip__"}
                    onValueChange={(v) => handleColumnMapping(col, v)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Skip" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__skip__">Skip</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          <span className="flex items-center gap-2">
                            <UserAvatar userId={m.userId} size="xs" />
                            {getDisplayName(m)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBackToUpload}>
                Back
              </Button>
              <Button
                onClick={handlePreviewClick}
                disabled={parsed.memberColumns.length === 0}
              >
                Preview
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && parsed && (
          <Dialog
            open={true}
            onOpenChange={(open) => !open && handleBackToMap()}
          >
            <DialogContent className="flex max-h-[95vh] max-w-[90vw] flex-col overflow-hidden rounded-lg">
              <DialogHeader>
                <DialogTitle>Import preview</DialogTitle>
              </DialogHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
                <div className="shrink-0 flex flex-wrap gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewFilter("all")}
                    className={
                      previewFilter === "all"
                        ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                        : ""
                    }
                  >
                    All ({validRows.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewFilter("duplicate")}
                    className={
                      previewFilter === "duplicate"
                        ? "border-warning bg-warning text-white hover:bg-warning/90"
                        : ""
                    }
                  >
                    Duplicates ({duplicateCount})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewFilter("error")}
                    className={
                      previewFilter === "error"
                        ? "border-destructive bg-destructive text-white hover:bg-destructive/90"
                        : ""
                    }
                  >
                    Errors ({errorCount})
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">
                          Date
                        </th>
                        <th className="px-2 py-1.5 text-left font-medium">
                          Description
                        </th>
                        <th className="px-2 py-1.5 text-right font-medium">
                          Cost
                        </th>
                        <th className="px-2 py-1.5 text-left font-medium">
                          Who owes
                        </th>
                        <th className="px-2 py-1.5 text-left font-medium">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map(({ row, validation }) => (
                        <tr
                          key={row.rowIndex}
                          className={
                            !validation.valid
                              ? "border-t border-border bg-destructive/10"
                              : isDuplicate(row)
                                ? "border-t border-border bg-warning/10"
                                : "border-t border-border"
                          }
                        >
                          <td className="w-20 shrink-0 px-2 py-1.5">
                            {row.date ? format(row.date, "MMM d, yy") : "-"}
                          </td>
                          <td className="min-w-0 wrap-break-word px-2 py-1.5">
                            {row.description || "-"}
                          </td>
                          <td className="w-16 shrink-0 px-2 py-1.5 text-right">
                            ${formatAmount(row.cost)}
                          </td>
                          <td className="min-w-0 wrap-break-word px-2 py-1.5">
                            {validation.valid && validation.splits
                              ? validation.splits
                                  .filter(
                                    (s) =>
                                      s.amount > 0 &&
                                      s.userId !== validation.payerUserId,
                                  )
                                  .map((s) => {
                                    const owee = members.find(
                                      (m) => m.userId === s.userId,
                                    );
                                    const payer = members.find(
                                      (m) =>
                                        m.userId === validation.payerUserId,
                                    );
                                    return owee && payer
                                      ? `${getDisplayName(owee)} ${owee.userId === currentUserId ? "owe" : "owes"} ${getDisplayName(payer)} $${formatAmount(s.amount)}`
                                      : null;
                                  })
                                  .filter(Boolean)
                                  .join("; ") || "-"
                              : "-"}
                          </td>
                          <td className="min-w-0 wrap-break-word px-2 py-1.5">
                            {!validation.valid ? (
                              <span className="text-destructive">
                                {validation.error || "Error"}
                              </span>
                            ) : isDuplicate(row) ? (
                              <span className="text-warning">Duplicate</span>
                            ) : (
                              <span className="text-positive">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="shrink-0 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                  <p className="mb-1.5 font-medium text-muted-foreground">
                    Balance per person
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {members
                      .filter((m) => balanceByUser[m.userId] !== undefined)
                      .map((m) => {
                        const bal = balanceByUser[m.userId] ?? 0;
                        return (
                          <div
                            key={m.userId}
                            className="flex items-center gap-1.5"
                          >
                            <UserAvatar userId={m.userId} size="xs" />
                            <span>
                              {getDisplayName(m)}:{" "}
                              <span
                                className={
                                  bal > 0
                                    ? "text-positive"
                                    : bal < 0
                                      ? "text-destructive"
                                      : ""
                                }
                              >
                                {`${bal > 0 ? "+" : bal < 0 ? "-" : ""}$${formatAmount(Math.abs(bal))}`}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    {Object.keys(balanceByUser).length === 0 && (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                </div>
                {(errorCount > 0 || duplicateCount > 0) && (
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {errorCount > 0 && (
                      <>
                        <span className="text-destructive">
                          {errorCount} row{errorCount !== 1 ? "s" : ""} with
                          errors
                        </span>{" "}
                        will be skipped. Fix them in your CSV or adjust column
                        mapping.
                        {duplicateCount > 0 && " "}
                      </>
                    )}
                    {duplicateCount > 0 && (
                      <span className="text-warning">
                        {duplicateCount} duplicate
                        {duplicateCount !== 1 ? "s" : ""} (already in tab) will
                        be skipped.
                      </span>
                    )}
                  </p>
                )}
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleBackToMap}>
                  Back
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={loading || importableCount === 0}
                >
                  {loading
                    ? "Importing..."
                    : `Import ${importableCount} expense${importableCount !== 1 ? "s" : ""}`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
