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
          {releases.length === 0 ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : (
            releases.map((release, i) => (
              <div
                key={`${release.version}-${release.date}`}
                className="rounded-xl border border-border bg-card/50 p-4 prose prose-invert prose-sm"
              >
                {(release.version || release.date) && (
                  <div className="mb-2 text-sm font-medium text-foreground">
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
      </DialogContent>
    </Dialog>
  );
}
