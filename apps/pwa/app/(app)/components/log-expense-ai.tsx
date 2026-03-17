import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  CornerDownLeft,
  Loader2,
  Mic,
  MicOff,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { useSpeechRecognitionSettings } from "@/lib/use-speech-recognition-settings";
import { vibrate } from "@/lib/vibrate";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExpenseAddedToast } from "@/components/expense-added-toast";
import { formatAmount } from "@/lib/format-amount";

type LogExpenseAIProps = {
  onSuccess: () => void;
  onCancel?: () => void;
  showCancelButton?: boolean;
};

export function LogExpenseAI({
  onSuccess,
  onCancel,
  showCancelButton = false,
}: LogExpenseAIProps) {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? "";

  const [aiInputText, setAiInputText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccessResult, setAiSuccessResult] = useState<{
    expenseId: string;
    tabId: string;
    amount: number;
    description: string;
    tabName: string;
    currency?: string;
    participants: Array<{
      userId: string;
      name: string | null;
      paid?: number;
      owes?: number;
    }>;
  } | null>(null);
  const aiFormRef = useRef<HTMLFormElement>(null);
  const aiTextareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceInputBaseRef = useRef("");

  const { settings: voiceSettings } = useSpeechRecognitionSettings();

  const {
    isListening,
    isSupported,
    start: startVoice,
    toggle: toggleVoice,
  } = useSpeechRecognition({
    onResult: (transcript) => {
      const base = voiceInputBaseRef.current;
      setAiInputText(base ? `${base} ${transcript}`.trim() : transcript);
    },
    onError: (err) => setAiError(err),
    lang: voiceSettings.lang,
  });

  useEffect(() => {
    if (isSupported && !aiLoading && voiceSettings.autoStart) {
      voiceInputBaseRef.current = "";
      startVoice();
    }
  }, [isSupported, aiLoading, startVoice, voiceSettings.autoStart]);

  useEffect(() => {
    if (!aiSuccessResult) {
      const id = setTimeout(() => aiTextareaRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [aiSuccessResult]);

  const handleToggleVoice = () => {
    if (!isSupported) {
      toast.error("Voice input is not supported in this browser");
      return;
    }
    vibrate(50);
    if (!isListening) {
      voiceInputBaseRef.current = aiInputText;
    }
    toggleVoice();
  };

  if (aiSuccessResult) {
    return (
      <div className="flex flex-col gap-3 pt-2">
        <p className="text-sm text-muted-foreground">
          {formatAmount(aiSuccessResult.amount, aiSuccessResult.currency)} for{" "}
          {aiSuccessResult.description} to {aiSuccessResult.tabName}
        </p>
        <Button
          variant="default"
          className="w-full"
          onClick={() => {
            vibrate(50);
            setAiSuccessResult(null);
            setAiInputText("");
            setAiError(null);
            voiceInputBaseRef.current = "";
            startVoice();
          }}
        >
          <Plus className="h-4 w-4" />
          Add another
        </Button>
        <Button variant="outline" className="w-full" onClick={onSuccess}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form
      ref={aiFormRef}
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const text = aiInputText.trim();
        if (!text || aiLoading) return;
        setAiLoading(true);
        setAiError(null);
        const result = await api.ai.addExpense({ text });
        setAiLoading(false);
        if (
          result.success &&
          result.expenseId &&
          result.tabId &&
          result.amount != null &&
          result.description &&
          result.tabName
        ) {
          vibrate(100);
          setAiSuccessResult({
            expenseId: result.expenseId,
            tabId: result.tabId,
            amount: result.amount,
            description: result.description,
            tabName: result.tabName,
            currency: result.currency,
            participants: result.participants ?? [],
          });
          toast.info(
            <ExpenseAddedToast
              expenseId={result.expenseId}
              tabId={result.tabId}
              amount={result.amount}
              description={result.description}
              tabName={result.tabName}
              currency={result.currency}
              participants={result.participants ?? []}
              currentUserId={currentUserId}
            />,
            { duration: 10_000 },
          );
          queryClient.invalidateQueries({ queryKey: ["friends"] });
          queryClient.invalidateQueries({ queryKey: ["tabs"] });
          queryClient.invalidateQueries({
            predicate: (q) => q.queryKey[0] === "expenses",
          });
          queryClient.invalidateQueries({
            predicate: (q) => q.queryKey[0] === "balances",
          });
          queryClient.invalidateQueries({ queryKey: ["activity"] });
          setAiInputText("");
        } else {
          setAiError(result.error ?? "Failed to add expense");
        }
      }}
    >
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant={isListening ? "destructive" : "outline"}
          className="h-28 w-28 shrink-0 touch-manipulation self-center rounded-full [&_svg]:h-10! [&_svg]:w-10!"
          onClick={handleToggleVoice}
          disabled={aiLoading || !isSupported}
          title={
            !isSupported
              ? "Voice input not supported"
              : isListening
                ? "Stop listening"
                : "Voice input"
          }
        >
          {isListening ? <MicOff /> : <Mic />}
        </Button>
        <div
          className={`rounded-lg transition-colors ${
            isListening
              ? "ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
              : ""
          }`}
        >
          <textarea
            ref={aiTextareaRef}
            value={aiInputText}
            onChange={(e) => setAiInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (aiInputText.trim() && !aiLoading) {
                  aiFormRef.current?.requestSubmit();
                }
              }
            }}
            placeholder={
              isListening
                ? "Speak your expense..."
                : "50 dinner with Sam at Olive Garden"
            }
            className="flex min-h-[100px] w-full rounded-md border border-input bg-input-bg px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-ring-offset disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none"
            disabled={aiLoading}
            autoFocus
          />
        </div>
      </div>
      {aiError && (
        <Alert variant="destructive" className="rounded-lg">
          <div className="flex items-start justify-between gap-3">
            <AlertDescription className="text-destructive m-0">
              {aiError}
            </AlertDescription>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setAiError(null)}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      )}
      <div className="flex gap-2">
        {showCancelButton && onCancel && (
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onCancel}
            disabled={aiLoading}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="default"
          size="default"
          disabled={aiLoading || !aiInputText.trim()}
          className="flex-1"
        >
          {aiLoading ? (
            <>
              <Loader2 className="h-4 w-4 text-foreground animate-spin" />
              Understanding...
            </>
          ) : (
            <>
              <CornerDownLeft className="h-4 w-4" />
              Add expense
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
