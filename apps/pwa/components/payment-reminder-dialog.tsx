import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import {
  PAYMENT_REMINDER_TONE_META,
  getPaymentReminderPushCopy,
  type PaymentReminderTone,
} from "models";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

type PaymentReminderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friendTabId: string;
  friendDisplayName: string;
  senderLabel: string;
  amountDisplay: string;
};

export function PaymentReminderDialog({
  open,
  onOpenChange,
  friendTabId,
  friendDisplayName,
  senderLabel,
  amountDisplay,
}: PaymentReminderDialogProps) {
  const [tone, setTone] = useState<PaymentReminderTone>("gentle");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const updateScrollChevrons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setShowScrollUp(false);
      setShowScrollDown(false);
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = el;
    const gap = 8;
    setShowScrollUp(scrollTop > gap);
    setShowScrollDown(scrollTop + clientHeight < scrollHeight - gap);
  }, []);

  useEffect(() => {
    if (open) setTone("gentle");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    updateScrollChevrons();
    const t = window.setTimeout(updateScrollChevrons, 50);
    const t2 = window.setTimeout(updateScrollChevrons, 300);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [open, updateScrollChevrons]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateScrollChevrons());
    ro.observe(el);
    const inner = el.firstElementChild;
    if (inner) ro.observe(inner);
    return () => ro.disconnect();
  }, [open, updateScrollChevrons]);

  async function sendReminder() {
    setSending(true);
    try {
      const r = await api.friends.sendPaymentReminder(friendTabId, tone);
      if (r.success) {
        toast.success("Reminder sent");
        onOpenChange(false);
      } else {
        toast.error(r.error ?? "Could not send reminder");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-[95vw] flex-col gap-4 overflow-hidden rounded-xl sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>Remind {friendDisplayName}</DialogTitle>
          <DialogDescription>
            Send them a reminder notification. Choose how direct it sounds.
          </DialogDescription>
        </DialogHeader>
        <div className="relative flex min-h-0 flex-1 flex-col">
          {showScrollUp && (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center bg-linear-to-b from-background via-background/80 to-transparent pb-3 pt-0.5"
              aria-hidden
            >
              <ChevronUp
                className="size-4 shrink-0 text-muted-foreground"
                strokeWidth={2.5}
              />
            </div>
          )}
          {showScrollDown && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center bg-linear-to-t from-background via-background/80 to-transparent pb-0.5 pt-3"
              aria-hidden
            >
              <ChevronDown
                className="size-4 shrink-0 text-muted-foreground"
                strokeWidth={2.5}
              />
            </div>
          )}
          <div
            ref={scrollRef}
            onScroll={updateScrollChevrons}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-0.5 [-webkit-overflow-scrolling:touch] touch-pan-y"
            role="listbox"
            aria-label="Reminder tone"
          >
            <div className="space-y-4 p-1">
              {PAYMENT_REMINDER_TONE_META.map((meta) => {
                const { title, body } = getPaymentReminderPushCopy(
                  meta.tone,
                  senderLabel,
                  amountDisplay,
                );
                const selected = tone === meta.tone;
                const optionId = `payment-reminder-tone-${meta.tone}`;
                return (
                  <div key={meta.tone} className="relative w-full">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "absolute -left-1 -top-2  z-20 cursor-pointer rounded-full text-xs font-normal",
                      )}
                    >
                      {meta.label}
                    </Badge>
                    <button
                      id={optionId}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => setTone(meta.tone)}
                      className={cn(
                        "w-full rounded-[22px] text-left shadow-[0_4px_24px_rgba(0,0,0,0.28)] transition-shadow duration-200",
                        selected &&
                          "ring-2 ring-primary ring-offset-2 ring-offset-background",
                      )}
                    >
                      {/* iOS PWA-style banner: title + time, "from Tab", body */}
                      <div
                        className={cn(
                          "flex gap-3 rounded-[22px] border border-white/12 bg-black/55 px-3.5 pb-3 pt-5 backdrop-blur-xl",
                        )}
                      >
                        <img
                          src="/icon-192x192.png"
                          alt=""
                          className="size-11 shrink-0 rounded-[14px] shadow-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 flex-1 text-sm font-medium leading-snug tracking-tight line-clamp-2">
                              {title}
                            </p>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              now
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                            from Tab
                          </p>
                          <p className="mt-0.5 text-xs leading-snug text-foreground/68 line-clamp-3">
                            {body}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void sendReminder()}
            disabled={sending}
          >
            {sending ? "Sending…" : "Send reminder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
