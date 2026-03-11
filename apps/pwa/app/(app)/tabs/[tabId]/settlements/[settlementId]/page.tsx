import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { useNavTitle } from "../../../../context/nav-title-context";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { EditSettlementForm } from "../../edit-settlement-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Pencil, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { getDisplayName } from "@/lib/display-name";
import { UserAvatar } from "@/components/user-avatar";

export function SettlementPage() {
  const { tabId, settlementId } = useParams<{
    tabId: string;
    settlementId: string;
  }>();
  const tabIdOrEmpty = tabId ?? "";
  const settlementIdOrEmpty = settlementId ?? "";
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const setNavTitle = useNavTitle();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: settlement, isLoading: settlementLoading } = useQuery({
    queryKey: ["settlement", tabIdOrEmpty, settlementIdOrEmpty],
    queryFn: async () => {
      const r = await api.settlements.get(tabIdOrEmpty, settlementIdOrEmpty);
      return r.success && r.settlement ? r.settlement : null;
    },
    enabled: !!tabIdOrEmpty && !!settlementIdOrEmpty,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: tab } = useQuery({
    queryKey: ["tab", tabIdOrEmpty],
    queryFn: async () => {
      const r = await api.tabs.get(tabIdOrEmpty);
      return r.success && r.tab ? r.tab : null;
    },
    enabled: !!tabIdOrEmpty,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: auditLog } = useQuery({
    queryKey: ["settlementAuditLog", tabIdOrEmpty, settlementIdOrEmpty],
    queryFn: async () => {
      const r = await api.settlements.getAuditLog(tabIdOrEmpty, settlementIdOrEmpty);
      return r.success ? (r.auditLog ?? []) : [];
    },
    enabled: !!tabIdOrEmpty && !!settlementIdOrEmpty && !!settlement,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    setNavTitle?.({
      title: settlement
        ? `${getDisplayName(settlement.fromUser, session?.user?.id ?? "")} paid ${getDisplayName(settlement.toUser, session?.user?.id ?? "")}`
        : "Settlement",
      backHref: `/tabs/${tabIdOrEmpty}`,
      icon: <Wallet className="h-5 w-5 shrink-0 text-positive" />,
    });
    return () => setNavTitle?.(null);
  }, [setNavTitle, settlement, tabIdOrEmpty, session?.user?.id]);

  if (!tabIdOrEmpty || !settlementIdOrEmpty) return null;

  if (settlementLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-4">
        <Spinner />
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">
          Settlement not found or you don't have access
        </p>
        <Button variant="outline" asChild>
          <Link to={`/tabs/${tabIdOrEmpty}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to tab
          </Link>
        </Button>
      </div>
    );
  }

  const currentUserId = session?.user?.id ?? "";

  function formatAuditDate(date: Date | string) {
    return new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  async function handleDelete() {
    setDeleteDialogOpen(false);
    setDeleteLoading(true);
    const result = await api.settlements.delete(tabIdOrEmpty, settlementIdOrEmpty);
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ["settlements", tabIdOrEmpty] });
      queryClient.invalidateQueries({ queryKey: ["expenses", tabIdOrEmpty] });
      queryClient.invalidateQueries({ queryKey: ["balances", tabIdOrEmpty] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success("Settlement deleted");
      navigate(`/tabs/${tabIdOrEmpty}`);
    } else {
      toast.error(result.error ?? "Failed to delete settlement");
    }
    setDeleteLoading(false);
  }

  return (
    <div className="p-4 pb-20">
      <div className="mx-auto max-w-md space-y-8">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-2 text-xl font-medium text-foreground">
                <UserAvatar userId={settlement.fromUserId} size="lg" />
                {getDisplayName(settlement.fromUser, currentUserId)}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                paid {getDisplayName(settlement.toUser, currentUserId)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(settlement.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <span className="text-foreground shrink-0 font-medium text-2xl">
              ${settlement.amount.toFixed(2)}
            </span>
          </div>

          <div className="mb-4 flex gap-2">
            <Button
              className="flex-1"
              onClick={() => setEditDialogOpen(true)}
              variant={"secondary"}
              size="sm"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteLoading}
              onClick={() => setDeleteDialogOpen(true)}
              size="sm"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {auditLog && auditLog.length > 0 && (
          <section>
            <h2 className="text-base font-medium mb-3">History</h2>
            <ul className="space-y-4 text-sm">
              {auditLog.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-2 text-muted-foreground"
                >
                  <UserAvatar userId={entry.performedById} size="xs" />
                  <span>
                    {entry.action === "create" && (
                      <>
                        Recorded by{" "}
                        {getDisplayName(entry.performedBy, currentUserId)}{" "}
                        {formatAuditDate(entry.performedAt)}
                      </>
                    )}
                    {entry.action === "update" && (
                      <>
                        <span className="block text-foreground/90">Edited</span>
                        <span className="block text-xs text-muted-foreground/80 mt-2">
                          {getDisplayName(entry.performedBy, currentUserId)} ·{" "}
                          {formatAuditDate(entry.performedAt)}
                        </span>
                      </>
                    )}
                    {entry.action === "delete" && (
                      <>
                        Deleted by{" "}
                        {getDisplayName(entry.performedBy, currentUserId)}{" "}
                        {formatAuditDate(entry.performedAt)}
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-[90vw] rounded-lg">
            <DialogHeader>
              <DialogTitle>Delete settlement?</DialogTitle>
              <DialogDescription>
                This will permanently delete this settlement and cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => handleDelete()}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-[90vw] rounded-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit settlement</DialogTitle>
              <DialogDescription>
                Update the settlement details
              </DialogDescription>
            </DialogHeader>
            <EditSettlementForm
              settlementId={settlementIdOrEmpty}
              tabId={tabIdOrEmpty}
              settlement={settlement}
              members={tab?.members ?? []}
              currentUserId={currentUserId}
              onSuccess={() => {
                setEditDialogOpen(false);
                queryClient.invalidateQueries({
                  queryKey: ["settlementAuditLog", settlementIdOrEmpty],
                });
                queryClient.invalidateQueries({
                  queryKey: ["settlement", settlementIdOrEmpty],
                });
              }}
              onDeleteSuccess={() => navigate(`/tabs/${tabIdOrEmpty}`)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
