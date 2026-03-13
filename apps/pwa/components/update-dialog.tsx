import { ChangelogMarkdown } from "@/components/changelog-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChangelog } from "@/lib/use-changelog";

function formatReleaseDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type UpdateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
};

export function UpdateDialog({
  open,
  onOpenChange,
  onUpdate,
}: UpdateDialogProps) {
  const releases = useChangelog(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>New Version Available</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {releases.length > 0 ? (
              <>
                Current: {__APP_VERSION__} → Latest: {releases[0].version}
              </>
            ) : (
              "Loading..."
            )}
          </p>
        </DialogHeader>
        <div className="flex max-h-96 flex-col gap-3 overflow-auto">
          {releases.length === 0 ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : (
            releases.map((release) => (
              <div
                key={`${release.version}-${release.date}`}
                className="rounded-xl border border-border bg-card/50 p-4 prose prose-invert prose-sm"
              >
                {(release.version || release.date) && (
                  <div className="mb-2 text-sm font-medium text-muted-foreground">
                    {release.version && `v${release.version}`}
                    {release.version && release.date && " on "}
                    {release.date && formatReleaseDate(release.date)}
                  </div>
                )}
                <ChangelogMarkdown>{release.content}</ChangelogMarkdown>
              </div>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={onUpdate}
          className="mt-4 w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
        >
          Update App
        </button>
      </DialogContent>
    </Dialog>
  );
}
