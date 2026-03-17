import { ChangelogMarkdown } from "@/components/changelog-markdown";
import type { ChangelogRelease } from "@/lib/use-changelog";

function formatReleaseDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
          {release.date && formatReleaseDate(release.date)}
        </div>
      )}
      <ChangelogMarkdown>{release.content}</ChangelogMarkdown>
    </div>
  );
}
