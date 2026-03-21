import { ChangelogMarkdown } from "@/components/changelog-markdown";
import { formatAbsoluteDate } from "@/lib/format-date";
import type { ChangelogRelease } from "@/lib/use-changelog";

type ChangelogReleaseCardProps = {
  release: ChangelogRelease;
};

export function ChangelogReleaseCard({ release }: ChangelogReleaseCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 prose prose-invert prose-sm">
      {(release.version || release.date) && (
        <div className="mb-2 text-sm font-medium text-foreground">
          {release.version && `v${release.version}`}
          {release.version && release.date && " on "}
          {release.date &&
            (Number.isNaN(new Date(release.date).getTime())
              ? release.date
              : formatAbsoluteDate(release.date))}
        </div>
      )}
      <ChangelogMarkdown>{release.content}</ChangelogMarkdown>
    </div>
  );
}
