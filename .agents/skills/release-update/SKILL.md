---
name: release-update
description: Prepares a PWA release by appending to changelog.json and optionally bumping version. Use when the user says "release update", "release", "prepare release", or wants to push a new PWA update.
---

# Release Update

Prepares the Tab PWA for a new release. Appends the new release to the changelog (users see all past releases in the UpdateGate modal) and optionally bumps the package version.

## Workflow

1. **Get release notes** from the user. If they did not provide changes, ask: "What changes should appear in this release?"

2. **Read current changelog.json** at [apps/pwa/public/changelog.json](apps/pwa/public/changelog.json) and [apps/pwa/package.json](apps/pwa/package.json) for the current version.

3. **Append new release** to the `releases` array at the beginning (newest first):
   - `version`: Use the version from package.json after bumping (or current + 0.0.1 patch if not bumping)
   - `date`: Today's date in YYYY-MM-DD format
   - `content`: Release notes as markdown (use `\n` for line breaks in JSON)
   - Example new release object:
   ```json
   {
     "version": "0.1.2",
     "date": "2025-03-14",
     "content": "- Fixed expense calculation\n- Improved offline support"
   }
   ```

4. **Bump version** in [apps/pwa/package.json](apps/pwa/package.json) (optional):
   - Increment patch: `0.1.1` -> `0.1.2`
   - Or follow semver: patch for fixes, minor for features, major for breaking changes

5. **Summarize** what was updated and remind the user to commit and deploy.

## Changelog format

changelog.json structure:
```json
{
  "releases": [
    { "version": "0.1.2", "date": "2025-03-14", "content": "..." },
    { "version": "0.1.1", "date": "2025-03-13", "content": "..." }
  ]
}
```

Releases are ordered newest first. Users see all releases in the UpdateGate modal.

## Files

| File | Purpose |
|------|---------|
| `apps/pwa/public/changelog.json` | All releases shown in the UpdateGate modal |
| `apps/pwa/package.json` | Version field for internal tracking |

## Notes

- The UpdateGate is triggered by the build (new hashed assets), not by the version field
- Fetch uses `cache: "no-store"` so users always get the latest changelog when the modal appears
- Backwards compatible: if changelog.json has the old `content` (string) format, it is still rendered as a single release
