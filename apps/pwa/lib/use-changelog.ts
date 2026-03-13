import { useEffect, useState } from "react";

export type ChangelogRelease = {
  version: string;
  date: string;
  content: string;
};

type ChangelogData =
  | { releases: ChangelogRelease[] }
  | { content: string };

export function useChangelog(enabled: boolean) {
  const [releases, setReleases] = useState<ChangelogRelease[]>([]);

  useEffect(() => {
    if (!enabled) return;

    async function load() {
      const res = await fetch("/changelog.json", { cache: "no-store" });
      const data = (await res.json()) as ChangelogData;

      if ("releases" in data && Array.isArray(data.releases)) {
        setReleases(data.releases);
      } else if ("content" in data && typeof data.content === "string") {
        setReleases([{ version: "", date: "", content: data.content }]);
      }
    }

    load();
  }, [enabled]);

  return releases;
}
