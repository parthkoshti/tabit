"use client";

import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ExpenseAddedSummary,
  type ExpenseAddedParticipant,
} from "@/components/expense-added-summary";

export type ExpenseCreatedCloseReason = "add-another" | "edit" | "dismiss";

export function ExpenseAddedDialog({
  open,
  onOpenChange,
  expenseId,
  tabId,
  amount,
  description,
  tabName,
  currency,
  participants,
  currentUserId,
  onCloseReason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseId: string;
  tabId: string;
  amount: number;
  description: string;
  tabName: string;
  currency?: string;
  participants: ExpenseAddedParticipant[];
  currentUserId: string;
  onCloseReason: (reason: ExpenseCreatedCloseReason) => void;
}) {
  const navigate = useNavigate();
  const ignoreNextDismiss = useRef(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      if (ignoreNextDismiss.current) {
        ignoreNextDismiss.current = false;
      } else {
        onCloseReason("dismiss");
      }
    }
    onOpenChange(next);
  }

  function handleAddAnother() {
    ignoreNextDismiss.current = true;
    onCloseReason("add-another");
  }

  function handleEdit() {
    ignoreNextDismiss.current = true;
    navigate(`/tabs/${tabId}/expenses/${expenseId}?edit=1`);
    onCloseReason("edit");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="gap-4 sm:max-w-md max-w-[90vw] rounded-lg"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>Expense added</DialogTitle>
        </DialogHeader>

        <div>
          <ExpenseAddedSummary
            amount={amount}
            description={description}
            tabName={tabName}
            currency={currency}
            participants={participants}
            currentUserId={currentUserId}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" onClick={handleAddAnother}>
            Add another expense
          </Button>
          <Button type="button" variant="outline" onClick={handleEdit}>
            Edit expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
