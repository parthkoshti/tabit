import { useState } from "react";
import { api } from "@/lib/api-client";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import { getDisplayName } from "@/lib/display-name";

type TabMemberUser = {
  id: string;
  email: string;
  name: string | null;
  username?: string | null;
};

type TabMember = {
  userId: string;
  role: string;
  user: TabMemberUser;
};

type TabParticipantRow = {
  id: string;
  kind: string;
  userId: string | null;
  displayName: string;
  user: TabMemberUser | null;
};

export type TabForPlaceholders = {
  members: TabMember[];
  participants: TabParticipantRow[];
};

export function PlaceholderParticipantsCard({
  tabIdOrEmpty,
  tab,
  currentUserId,
  onSuccess,
}: {
  tabIdOrEmpty: string;
  tab: TabForPlaceholders;
  currentUserId: string;
  onSuccess?: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeParticipantId, setMergeParticipantId] = useState<string | null>(
    null,
  );
  const [mergeTargetUserId, setMergeTargetUserId] = useState("");
  const [mergeLoading, setMergeLoading] = useState(false);

  const isOwner =
    tab.members.find((m) => m.userId === currentUserId)?.role === "owner";
  const placeholders = tab.participants.filter((p) => p.kind === "placeholder");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const r = await api.tabs.createPlaceholder(tabIdOrEmpty, newName.trim());
    setCreating(false);
    if (r.success) {
      setNewName("");
      toast.success("Placeholder added");
      onSuccess?.();
    } else {
      setError(r.error ?? "Failed to add placeholder");
    }
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renameId) return;
    setRenameLoading(true);
    setError(null);
    const r = await api.tabs.renamePlaceholder(
      tabIdOrEmpty,
      renameId,
      renameValue.trim(),
    );
    setRenameLoading(false);
    if (r.success) {
      setRenameId(null);
      toast.success("Placeholder renamed");
      onSuccess?.();
    } else {
      setError(r.error ?? "Failed to rename");
    }
  }

  async function handleMerge() {
    if (!mergeParticipantId || !mergeTargetUserId) return;
    setMergeLoading(true);
    setError(null);
    const r = await api.tabs.mergePlaceholder(
      tabIdOrEmpty,
      mergeParticipantId,
      mergeTargetUserId,
    );
    setMergeLoading(false);
    if (r.success) {
      setMergeOpen(false);
      setMergeParticipantId(null);
      setMergeTargetUserId("");
      toast.success("Placeholder merged");
      onSuccess?.();
    } else {
      setError(r.error ?? "Merge failed");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Placeholder participants</CardTitle>
        <CardDescription>
          Add people who do not have accounts yet so you can split expenses and
          settlements. Merging is final and rewrites history for this tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (e.g. Sam)"
            maxLength={80}
            disabled={creating}
          />
          <Button type="submit" disabled={creating || !newName.trim()}>
            {creating ? "Adding..." : "Add placeholder"}
          </Button>
        </form>
        {placeholders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No placeholders yet</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {placeholders.map((p) => (
              <li
                key={p.id}
                className="flex gap-2 rounded-md border border-border p-3 flex-row items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <UserAvatar userId={p.userId ?? p.id} size="sm" />
                  <span className="font-medium truncate">{p.displayName} </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setRenameId(p.id);
                      setRenameValue(p.displayName);
                    }}
                  >
                    Rename
                  </Button>
                  {isOwner && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setMergeParticipantId(p.id);
                        setMergeTargetUserId("");
                        setMergeOpen(true);
                      }}
                    >
                      Merge
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <Dialog
        open={renameId != null}
        onOpenChange={(o) => !o && setRenameId(null)}
      >
        <DialogContent className="max-w-[90vw] rounded-lg">
          <DialogHeader>
            <DialogTitle>Rename placeholder</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={80}
              required
            />
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameId(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={renameLoading}>
                {renameLoading ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <AlertDialogContent className="max-w-[90vw] rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Merge placeholder?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. All expenses, settlements, recurring rules,
              balances, and activity that used this placeholder will point at
              the member you choose.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Select
              value={mergeTargetUserId || undefined}
              onValueChange={setMergeTargetUserId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose tab member to merge into" />
              </SelectTrigger>
              <SelectContent>
                {tab.members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    <span className="flex items-center gap-2">
                      <UserAvatar userId={m.userId} size="xs" />
                      {getDisplayName(m.user, currentUserId)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mergeLoading}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={mergeLoading || !mergeTargetUserId}
              onClick={() => void handleMerge()}
            >
              {mergeLoading ? "Merging..." : "Merge permanently"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
