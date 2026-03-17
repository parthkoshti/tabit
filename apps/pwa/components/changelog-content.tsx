import { ChangelogReleaseCard } from "@/components/changelog-release-card";
import { useChangelog } from "@/lib/use-changelog";

type ChangelogContentProps = {
  enabled: boolean;
  className?: string;
};

export function ChangelogContent({
  enabled,
  className,
}: ChangelogContentProps) {
  const releases = useChangelog(enabled);

  if (releases.length === 0) {
    return <p className="text-muted-foreground text-sm">Loading...</p>;
  }

  return (
    <div className={className}>
      {releases.map((release) => (
        <ChangelogReleaseCard
          key={`${release.version}-${release.date}`}
          release={release}
        />
      ))}
    </div>
  );
}
