import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChangelogContent } from "@/components/changelog-content";
import { useChangelog } from "@/lib/use-changelog";

type ChangelogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ChangelogDialog({ open, onOpenChange }: ChangelogDialogProps) {
  const releases = useChangelog(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[90vw] rounded-lg flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Changelog</DialogTitle>
            {releases.length > 0 && releases[0].version === __APP_VERSION__ && (
              <span className="rounded-full bg-positive/20 px-2 py-0.5 text-xs font-medium text-positive">
                Latest
              </span>
            )}
          </div>
          {releases.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Version {__APP_VERSION__}
            </p>
          )}
        </DialogHeader>
        <div className="flex max-h-96 flex-col gap-3 overflow-auto">
          <ChangelogContent enabled={open} className="flex flex-col gap-3" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
