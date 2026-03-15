"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { ExpenseReaction } from "data";
import { SmilePlus } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";

function ReactionWhoReacted({
  emoji,
  userIds,
  currentUserId,
  getDisplayName,
  hasCurrentUser,
  compact,
  onReactionClick,
  onOpenPicker,
}: {
  emoji: string;
  userIds: string[];
  currentUserId: string;
  getDisplayName: (userId: string) => string;
  hasCurrentUser: boolean;
  compact: boolean;
  onReactionClick: () => void;
  onOpenPicker?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className={`relative inline-flex rounded-full p-1 transition-colors ${
          hasCurrentUser
            ? "border border-primary/50 bg-primary/10 text-foreground"
            : "bg-muted/40 text-foreground"
        } ${compact ? "p-0.5" : ""}`}
      >
        <button
          type="button"
          onClick={
            hasCurrentUser && onOpenPicker ? onOpenPicker : onReactionClick
          }
          className="rounded-full hover:bg-muted/80 transition-colors"
        >
          <span
            className={`relative block ${compact ? "text-sm" : "text-base"}`}
          >
            {emoji}
          </span>
        </button>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-muted-foreground/80 px-1 text-[10px] text-background tabular-nums"
            onClick={(e) => e.stopPropagation()}
          >
            {userIds.length}
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        className="w-auto p-2"
        align="start"
        sideOffset={4}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1.5 min-w-[140px]">
          {userIds.map((userId) => (
            <div key={userId} className="flex items-center gap-2 text-sm">
              <UserAvatar userId={userId} size="xs" />
              <span className="text-foreground">
                {userId === currentUserId ? "You" : getDisplayName(userId)}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type ExpenseReactionsProps = {
  expenseId: string;
  tabId: string;
  reactions: ExpenseReaction[];
  currentUserId: string;
  compact?: boolean;
  getDisplayName?: (userId: string) => string;
};

export function ExpenseReactions({
  expenseId,
  tabId,
  reactions,
  currentUserId,
  compact = false,
  getDisplayName,
}: ExpenseReactionsProps) {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerTheme = resolvedTheme === "light" ? Theme.LIGHT : Theme.DARK;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["expense", tabId, expenseId] });
    queryClient.invalidateQueries({ queryKey: ["expenses", tabId] });
  }

  async function handleReactionClick(emoji: string) {
    const existing = reactions.find((r) => r.emoji === emoji);
    const hasCurrentUser = existing?.userIds.includes(currentUserId);

    setPickerOpen(false);

    if (hasCurrentUser) {
      const result = await api.expenses.removeReaction(tabId, expenseId);
      if (result.success) invalidate();
    } else {
      const result = await api.expenses.addReaction(tabId, expenseId, emoji);
      if (result.success) invalidate();
    }
  }

  function stopLinkNavigation(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  const userHasReaction = reactions.some((r) =>
    r.userIds.includes(currentUserId),
  );

  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${compact ? "gap-1" : "gap-2"}`}
      onClick={stopLinkNavigation}
      onMouseDown={stopLinkNavigation}
    >
      {reactions.map((r) => {
        const hasCurrentUser = r.userIds.includes(currentUserId);
        const showWhoReacted =
          r.count >= 1 && getDisplayName && r.userIds.length > 0;

        if (showWhoReacted) {
          return (
            <ReactionWhoReacted
              key={r.emoji}
              emoji={r.emoji}
              userIds={r.userIds}
              currentUserId={currentUserId}
              getDisplayName={getDisplayName}
              hasCurrentUser={hasCurrentUser}
              compact={compact}
              onReactionClick={() => handleReactionClick(r.emoji)}
              onOpenPicker={
                hasCurrentUser ? () => setPickerOpen(true) : undefined
              }
            />
          );
        }

        return (
          <button
            key={r.emoji}
            type="button"
            onClick={
              hasCurrentUser
                ? () => setPickerOpen(true)
                : () => handleReactionClick(r.emoji)
            }
            className={`relative inline-flex rounded-full p-1 transition-colors hover:bg-muted/80 ${
              hasCurrentUser
                ? "border border-primary/50 bg-primary/10 text-foreground"
                : "bg-muted/40 text-foreground hover:bg-muted/60"
            } ${compact ? "p-0.5" : ""}`}
          >
            <span className={`block ${compact ? "text-sm" : "text-base"}`}>
              {r.emoji}
            </span>
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-muted-foreground/80 px-1 text-[10px] text-background tabular-nums pointer-events-none">
              {r.count}
            </span>
          </button>
        );
      })}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        {!userHasReaction && (
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size={compact ? "sm" : "default"}
              className={`size-8 p-0 ${compact ? "size-6" : ""}`}
            >
              <SmilePlus />
            </Button>
          </DialogTrigger>
        )}
        <DialogContent
          className="max-w-[90vw] rounded-xl p-4 gap-3 overflow-hidden sm:max-w-md"
          showCloseButton={false}
          onPointerDownOutside={() => setPickerOpen(false)}
          onInteractOutside={() => setPickerOpen(false)}
        >
          <div className="flex min-w-0 flex-col gap-3">
            {userHasReaction && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full justify-center shrink-0"
                onClick={async () => {
                  setPickerOpen(false);
                  const result = await api.expenses.removeReaction(
                    tabId,
                    expenseId,
                  );
                  if (result.success) invalidate();
                }}
              >
                Remove reaction
              </Button>
            )}
            <div className="emoji-picker-app-theme min-w-0 overflow-hidden rounded-lg">
              <EmojiPicker
                theme={pickerTheme}
                onEmojiClick={(data) => handleReactionClick(data.emoji)}
                previewConfig={{ showPreview: false }}
                width="100%"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
