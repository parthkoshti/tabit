import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavTitle } from "@/app/(app)/context/nav-title-context";
import { LogExpenseAI } from "@/app/(app)/components/log-expense-ai";
import { LogExpenseManual } from "@/app/(app)/components/log-expense-manual";
import { api } from "@/lib/api-client";
import { ReceiptText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const ADD_EXPENSE_PREFERENCE_KEY = "add_expense_preference";

function getStoredPreference(): "ai" | "manual" | null {
  try {
    const ls = localStorage.getItem(ADD_EXPENSE_PREFERENCE_KEY);
    if (ls === "ai" || ls === "manual") return ls;
  } catch {
    /* ignore */
  }
  return null;
}

function setStoredPreference(value: "ai" | "manual") {
  try {
    localStorage.setItem(ADD_EXPENSE_PREFERENCE_KEY, value);
  } catch {
    /* ignore */
  }
}

export function LogExpensePage() {
  const setNavTitle = useNavTitle();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: preferences } = useQuery({
    queryKey: ["preferences"],
    queryFn: async () => {
      const r = await api.preferences.get();
      return r.success
        ? { addExpensePreference: r.addExpensePreference }
        : null;
    },
    enabled: true,
  });

  const [entryMode, setEntryMode] = useState<"ai" | "manual">(() => {
    return getStoredPreference() ?? preferences?.addExpensePreference ?? "ai";
  });

  useEffect(() => {
    setNavTitle?.({ title: "Log Expense", backHref: "/tabs" });
  }, [setNavTitle]);

  useEffect(() => {
    const pref =
      getStoredPreference() ?? preferences?.addExpensePreference ?? "ai";
    setEntryMode(pref);
  }, [preferences?.addExpensePreference]);

  const handleEntryModeChange = (mode: "ai" | "manual") => {
    setEntryMode(mode);
    setStoredPreference(mode);
    api.preferences.update({ addExpensePreference: mode }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
    });
  };

  const handleSuccess = () => {
    navigate("/tabs");
  };

  return (
    <div className="flex flex-col gap-6 p-4 h-full min-h-full">
      <div className="flex w-full justify-center">
        <div
          role="tablist"
          className="inline-flex rounded-full border border-border bg-muted/50 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={entryMode === "ai"}
            onClick={() => handleEntryModeChange("ai")}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
              entryMode === "ai"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Sparkles className="h-4 w-4" />
            AI
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={entryMode === "manual"}
            onClick={() => handleEntryModeChange("manual")}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
              entryMode === "manual"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ReceiptText className="h-4 w-4" />
            Manual
          </button>
        </div>
      </div>

      {entryMode === "ai" ? (
        <LogExpenseAI
          onSuccess={handleSuccess}
          onCancel={handleSuccess}
          showCancelButton
        />
      ) : (
        <LogExpenseManual onSuccess={handleSuccess} />
      )}
    </div>
  );
}
