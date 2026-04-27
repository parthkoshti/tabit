"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PendingRecurringRuleWithoutTemplate } from "models";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  CALENDAR_POPOVER_CONTENT_CLASSNAME,
} from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeCalendarDate } from "@/lib/format-date";
import { Calendar as CalendarIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type RecurringTemplatePayload = {
  amount: number;
  currency: string;
  description: string;
  paidById: string;
  splitType: "equal" | "custom" | "percent" | "shares";
  participantIds: string[];
  splits?: { userId: string; amount?: number; weight?: number }[];
};

function todayKey(): string {
  const d = new Date();
  return dateKeyFromDate(d);
}

function dateKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calendar date YYYY-MM-DD for instant `d` in IANA `zone`; device local if zone missing/invalid. */
function formatDateKeyInZone(d: Date, zone?: string | null): string {
  const z = zone?.trim();
  if (!z) {
    return dateKeyFromDate(d);
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: z }).format(d);
  } catch {
    return dateKeyFromDate(d);
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: z,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const mo = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (y && mo && day) {
    return `${y}-${mo.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return dateKeyFromDate(d);
}

function maxDateKey(a: string, b: string): string {
  return a >= b ? a : b;
}

function dateFromKey(key: string): Date | undefined {
  const t = key.trim();
  if (!t) return undefined;
  const parts = t.split("-");
  if (parts.length !== 3) return undefined;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return undefined;
  }
  const out = new Date(y, m - 1, d);
  return Number.isNaN(out.getTime()) ? undefined : out;
}

/** English ordinal suffix only (st, nd, rd, th) for 1–31. */
function ordinalSuffix(day: number): string {
  const n = Math.min(31, Math.max(1, Math.floor(day)));
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function parsedDayFromMonthlyField(text: string): number {
  if (text.trim() === "") return 1;
  const n = Number.parseInt(text, 10);
  if (Number.isNaN(n)) return 1;
  return Math.min(31, Math.max(1, n));
}

function parsedIntervalDaysFromField(text: string): number {
  if (text.trim() === "") return 1;
  const n = Number.parseInt(text, 10);
  if (Number.isNaN(n)) return 1;
  return Math.min(365, Math.max(1, n));
}

function parsedMaxCountFromField(text: string): number | null {
  const t = text.trim();
  if (t === "") return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(999_999, n);
}

const WEEKDAYS: { id: number; label: string }[] = [
  { id: 1, label: "Mon" },
  { id: 2, label: "Tue" },
  { id: 3, label: "Wed" },
  { id: 4, label: "Thu" },
  { id: 5, label: "Fri" },
  { id: 6, label: "Sat" },
  { id: 7, label: "Sun" },
];

export function MakeRecurringExpenseDialog({
  open,
  onOpenChange,
  template,
  draft,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: RecurringTemplatePayload | null;
  /** When reopening "Edit recurring", hydrate fields from this saved schedule. */
  draft?: PendingRecurringRuleWithoutTemplate | null;
  onConfirm: (payload: PendingRecurringRuleWithoutTemplate) => void;
}) {
  const { data: preferencesData } = useQuery({
    queryKey: ["preferences"],
    queryFn: async () => api.preferences.get(),
    staleTime: 60_000,
  });
  const userTimeZone =
    preferencesData?.success && preferencesData.timezone?.trim()
      ? preferencesData.timezone.trim()
      : null;

  const [mode, setMode] = useState<"interval_days" | "monthly_nth" | "weekly">(
    "monthly_nth",
  );
  const [intervalDaysText, setIntervalDaysText] = useState("7");
  const [anchorDate, setAnchorDate] = useState(todayKey);
  const [dayOfMonthText, setDayOfMonthText] = useState("1");
  const [weekdays, setWeekdays] = useState<number[]>([1]);
  const [startsOn, setStartsOn] = useState(todayKey);
  const [endsOn, setEndsOn] = useState("");
  const [maxCount, setMaxCount] = useState("");
  const [startsPickerOpen, setStartsPickerOpen] = useState(false);
  const [endsPickerOpen, setEndsPickerOpen] = useState(false);
  const [anchorPickerOpen, setAnchorPickerOpen] = useState(false);

  useEffect(() => {
    if (!open || !template) return;
    const min = formatDateKeyInZone(new Date(), userTimeZone);
    if (draft) {
      const s = draft.schedule;
      if (s.type === "interval_days") {
        setMode("interval_days");
        setIntervalDaysText(String(s.intervalDays));
        setAnchorDate(maxDateKey(s.anchorDate, min));
      } else if (s.type === "monthly_nth") {
        setMode("monthly_nth");
        setDayOfMonthText(String(s.dayOfMonth));
      } else {
        setMode("weekly");
        setWeekdays([...s.weekdays].sort((a, b) => a - b));
      }
      setStartsOn(maxDateKey(draft.startsOn, min));
      setEndsOn(
        draft.endsOn != null &&
          draft.endsOn.trim() !== "" &&
          draft.endsOn >= min
          ? draft.endsOn
          : "",
      );
      setMaxCount(
        draft.maxCount != null && draft.maxCount > 0
          ? String(draft.maxCount)
          : "",
      );
      return;
    }
    setAnchorDate((a) => maxDateKey(a, min));
    setStartsOn((s) => maxDateKey(s, min));
    setEndsOn((e) => {
      const t = e.trim();
      if (!t) return e;
      return t < min ? "" : t;
    });
  }, [open, template, draft, userTimeZone]);

  const isDateBeforeMinSelectable = (d: Date) =>
    formatDateKeyInZone(d, userTimeZone) <
    formatDateKeyInZone(new Date(), userTimeZone);

  const schedule = useMemo(() => {
    const minKey = formatDateKeyInZone(new Date(), userTimeZone);
    if (mode === "interval_days") {
      return {
        type: "interval_days" as const,
        intervalDays: parsedIntervalDaysFromField(intervalDaysText),
        anchorDate: anchorDate || minKey,
      };
    }
    if (mode === "monthly_nth") {
      return {
        type: "monthly_nth" as const,
        dayOfMonth: parsedDayFromMonthlyField(dayOfMonthText),
      };
    }
    return {
      type: "weekly" as const,
      weekdays: [...new Set(weekdays)].sort((a, b) => a - b),
    };
  }, [
    mode,
    intervalDaysText,
    anchorDate,
    dayOfMonthText,
    weekdays,
    userTimeZone,
  ]);

  function toggleWeekday(id: number) {
    setWeekdays((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id].sort((a, b) => a - b);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!template) return;
    if (mode === "weekly" && weekdays.length === 0) {
      toast.error("Select at least one weekday");
      return;
    }
    const maxCountParsed = maxCount.trim()
      ? Number.parseInt(maxCount, 10)
      : NaN;
    const maxCountBody =
      Number.isFinite(maxCountParsed) && maxCountParsed > 0
        ? { maxCount: maxCountParsed }
        : {};

    const minKey = formatDateKeyInZone(new Date(), userTimeZone);
    const startsKey = maxDateKey(startsOn.trim() || minKey, minKey);
    const payload: PendingRecurringRuleWithoutTemplate = {
      schedule,
      startsOn: startsKey,
      ...(endsOn.trim() ? { endsOn: maxDateKey(endsOn.trim(), minKey) } : {}),
      ...maxCountBody,
    };
    onConfirm(payload);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o && template && !draft) {
          const min = formatDateKeyInZone(new Date(), userTimeZone);
          setStartsOn(min);
          setAnchorDate(min);
        }
      }}
    >
      <DialogContent
        className="max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-lg"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>Recurring Expense</DialogTitle>
        </DialogHeader>
        {template ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Tabs
                value={mode}
                onValueChange={(v) =>
                  setMode(v as "interval_days" | "monthly_nth" | "weekly")
                }
                aria-labelledby="repeat-schedule-label"
                className="w-full space-y-4"
              >
                <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-muted p-1">
                  <TabsTrigger
                    value="monthly_nth"
                    className="px-2 py-1 text-xs sm:text-sm"
                  >
                    Monthly
                  </TabsTrigger>
                  <TabsTrigger
                    value="interval_days"
                    className="px-2 py-1 text-xs sm:text-sm"
                  >
                    Every X days
                  </TabsTrigger>
                  <TabsTrigger
                    value="weekly"
                    className="px-2 py-1 text-xs sm:text-sm"
                  >
                    Weekly
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="monthly_nth" className="space-y-2">
                  <Label htmlFor="dayOfMonth" className="sr-only">
                    Day of month (1–31)
                  </Label>
                  <div className="flex h-12 min-w-0 items-center gap-0 rounded-md border border-input bg-input-bg shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-ring-offset focus-within:ring-offset-2">
                    <span className="shrink-0 pl-3 text-base leading-none text-muted-foreground">
                      On the{" "}
                    </span>
                    <Input
                      id="dayOfMonth"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="1"
                      min={1}
                      max={31}
                      value={dayOfMonthText}
                      onChange={(e) => {
                        const raw = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 2);
                        if (raw === "") {
                          setDayOfMonthText("");
                          return;
                        }
                        const n = Number.parseInt(raw, 10);
                        if (Number.isNaN(n) || n === 0) {
                          setDayOfMonthText("");
                          return;
                        }
                        if (n > 31) {
                          setDayOfMonthText("31");
                          return;
                        }
                        setDayOfMonthText(raw);
                      }}
                      onBlur={() => {
                        setDayOfMonthText((t) => {
                          if (t.trim() === "") return "1";
                          return String(parsedDayFromMonthlyField(t));
                        });
                      }}
                      style={{
                        width: dayOfMonthText.length >= 2 ? "2.35ch" : "1.2ch",
                      }}
                      className="box-content h-12 min-w-0 shrink-0 border-0 bg-transparent p-0 text-center text-base leading-none text-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 tabular-nums flex-none pl-1"
                    />
                    <span className="min-w-0 flex-1 truncate pr-3 text-base leading-none text-muted-foreground tabular-nums">
                      {ordinalSuffix(parsedDayFromMonthlyField(dayOfMonthText))}{" "}
                      of every month
                    </span>
                  </div>
                </TabsContent>
                <TabsContent value="interval_days" className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="intervalDays" className="sr-only">
                      Repeat every how many days (1–365)
                    </Label>
                    <div className="flex h-12 min-w-0 items-center gap-0 rounded-md border border-input bg-input-bg shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-ring-offset focus-within:ring-offset-2">
                      <span className="shrink-0 pl-3 text-base leading-none text-muted-foreground">
                        Every{" "}
                      </span>
                      <Input
                        id="intervalDays"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="7"
                        value={intervalDaysText}
                        onChange={(e) => {
                          const raw = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 3);
                          if (raw === "") {
                            setIntervalDaysText("");
                            return;
                          }
                          const n = Number.parseInt(raw, 10);
                          if (Number.isNaN(n) || n === 0) {
                            setIntervalDaysText("");
                            return;
                          }
                          if (n > 365) {
                            setIntervalDaysText("365");
                            return;
                          }
                          setIntervalDaysText(raw);
                        }}
                        onBlur={() => {
                          setIntervalDaysText((t) => {
                            if (t.trim() === "") return "1";
                            return String(parsedIntervalDaysFromField(t));
                          });
                        }}
                        style={{
                          width:
                            intervalDaysText.length >= 3
                              ? "3.2ch"
                              : intervalDaysText.length >= 2
                                ? "2.35ch"
                                : "1.2ch",
                        }}
                        className="box-content h-12 min-w-0 shrink-0 border-0 bg-transparent p-0 text-center text-base leading-none text-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 tabular-nums flex-none pl-1"
                      />
                      <span className="min-w-0 flex-1 truncate pl-1 pr-3 text-base leading-none text-muted-foreground tabular-nums">
                        {parsedIntervalDaysFromField(intervalDaysText) === 1
                          ? "day"
                          : "days"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="anchorDate-trigger"
                      className="text-xs sm:text-sm"
                    >
                      From date (anchor)
                    </Label>
                    <Popover
                      open={anchorPickerOpen}
                      onOpenChange={setAnchorPickerOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          id="anchorDate-trigger"
                          type="button"
                          variant="outline"
                          className={cn(
                            "h-9 w-full min-w-0 justify-start gap-2 rounded-md border-input bg-input-bg px-2 text-sm font-normal shadow-sm hover:bg-input-bg sm:px-3",
                          )}
                        >
                          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 truncate">
                            {formatRelativeCalendarDate(
                              dateFromKey(anchorDate) ?? new Date(),
                            )}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className={CALENDAR_POPOVER_CONTENT_CLASSNAME}
                        align="start"
                        sideOffset={4}
                        collisionPadding={12}
                      >
                        <Calendar
                          mode="single"
                          selected={dateFromKey(anchorDate)}
                          defaultMonth={dateFromKey(anchorDate) ?? new Date()}
                          className="w-full"
                          disabled={isDateBeforeMinSelectable}
                          onSelect={(date) => {
                            if (date) {
                              const min = formatDateKeyInZone(
                                new Date(),
                                userTimeZone,
                              );
                              const key = maxDateKey(
                                formatDateKeyInZone(date, userTimeZone),
                                min,
                              );
                              setAnchorDate(key);
                              setAnchorPickerOpen(false);
                            }
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </TabsContent>
                <TabsContent value="weekly" className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Tap days to include in the schedule
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {WEEKDAYS.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => toggleWeekday(w.id)}
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors",
                          weekdays.includes(w.id)
                            ? "border-primary/50 bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:bg-muted/50",
                        )}
                      >
                        <span className="min-w-0 truncate">{w.label}</span>
                      </button>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 space-y-2">
                <Label
                  htmlFor="startsOn-trigger"
                  className="text-xs sm:text-sm"
                >
                  Start date
                </Label>
                <Popover
                  open={startsPickerOpen}
                  onOpenChange={setStartsPickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      id="startsOn-trigger"
                      type="button"
                      variant="outline"
                      className={cn(
                        "h-9 w-full min-w-0 justify-start gap-2 rounded-md border-input bg-input-bg px-2 text-sm font-normal shadow-sm hover:bg-input-bg sm:px-3",
                      )}
                    >
                      <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate">
                        {formatRelativeCalendarDate(
                          dateFromKey(startsOn) ?? new Date(),
                        )}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className={CALENDAR_POPOVER_CONTENT_CLASSNAME}
                    align="start"
                    sideOffset={4}
                    collisionPadding={12}
                  >
                    <Calendar
                      mode="single"
                      selected={dateFromKey(startsOn)}
                      defaultMonth={dateFromKey(startsOn) ?? new Date()}
                      className="w-full"
                      disabled={isDateBeforeMinSelectable}
                      onSelect={(date) => {
                        if (date) {
                          const min = formatDateKeyInZone(
                            new Date(),
                            userTimeZone,
                          );
                          const key = maxDateKey(
                            formatDateKeyInZone(date, userTimeZone),
                            min,
                          );
                          setStartsOn(key);
                          setStartsPickerOpen(false);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="endsOn-trigger" className="text-xs sm:text-sm">
                  End date
                </Label>
                <Popover open={endsPickerOpen} onOpenChange={setEndsPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="endsOn-trigger"
                      type="button"
                      variant="outline"
                      className={cn(
                        "h-9 w-full min-w-0 justify-start gap-2 rounded-md border-input bg-input-bg px-2 text-sm font-normal shadow-sm hover:bg-input-bg sm:px-3",
                        !endsOn.trim() && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate">
                        {endsOn.trim()
                          ? formatRelativeCalendarDate(
                              dateFromKey(endsOn) ?? new Date(),
                            )
                          : "Optional"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className={CALENDAR_POPOVER_CONTENT_CLASSNAME}
                    align="start"
                    sideOffset={4}
                    collisionPadding={12}
                  >
                    <Calendar
                      mode="single"
                      selected={endsOn.trim() ? dateFromKey(endsOn) : undefined}
                      defaultMonth={
                        endsOn.trim()
                          ? (dateFromKey(endsOn) ?? new Date())
                          : (dateFromKey(startsOn) ?? new Date())
                      }
                      className="w-full"
                      disabled={isDateBeforeMinSelectable}
                      onSelect={(date) => {
                        if (date) {
                          const min = formatDateKeyInZone(
                            new Date(),
                            userTimeZone,
                          );
                          const key = maxDateKey(
                            formatDateKeyInZone(date, userTimeZone),
                            min,
                          );
                          setEndsOn(key);
                          setEndsPickerOpen(false);
                        }
                      }}
                    />
                    {endsOn.trim() ? (
                      <div className="p-2 bg-background">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setEndsOn("");
                            setEndsPickerOpen(false);
                          }}
                        >
                          Clear end date
                        </Button>
                      </div>
                    ) : null}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxCount" className="sr-only">
                Repeat count (leave empty for unlimited)
              </Label>
              <div className="flex h-10 min-w-0 items-center gap-0 rounded-md border border-input bg-input-bg text-sm shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-ring-offset focus-within:ring-offset-2">
                <span className="shrink-0 pl-3 text-sm leading-none text-muted-foreground">
                  Repeat{" "}
                </span>
                <Input
                  id="maxCount"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="∞"
                  value={maxCount}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    if (digits === "") {
                      setMaxCount("");
                      return;
                    }
                    const stripped = digits.replace(/^0+/, "") || "";
                    setMaxCount(stripped.slice(0, 6));
                  }}
                  onBlur={() => {
                    setMaxCount((t) => {
                      const parsed = parsedMaxCountFromField(t);
                      if (parsed == null) return "";
                      return String(parsed);
                    });
                  }}
                  style={{
                    width: maxCount
                      ? `${Math.min(6, Math.max(1, maxCount.length)) + 0.35}ch`
                      : "2.5ch",
                  }}
                  className="box-content h-10 min-w-0 shrink-0 border-0 bg-transparent p-0 text-center text-sm leading-none text-foreground placeholder:text-muted-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 tabular-nums flex-none pl-0.5"
                />
                <span className="min-w-0 flex-1 truncate pl-0.5 pr-3 text-sm leading-none text-muted-foreground tabular-nums">
                  {(() => {
                    const n = parsedMaxCountFromField(maxCount);
                    if (n === 1) return "time";
                    return "times";
                  })()}
                </span>
              </div>
            </div>
            <DialogFooter className="grid grid-cols-2 items-center w-full gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="w-full">
                Save
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
