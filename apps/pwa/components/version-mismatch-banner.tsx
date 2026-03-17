import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChangelogContent } from "@/components/changelog-content";
import { useChangelog } from "@/lib/use-changelog";
import { useUpdateBanner } from "@/app/(app)/context/update-banner-context";

export function VersionMismatchBanner() {
  const { showBanner, updateServiceWorker } = useUpdateBanner();
  const releases = useChangelog(showBanner);

  const handleUpdate = async () => {
    updateServiceWorker(true);
    window.location.reload();
  };

  return (
    <Dialog open={showBanner} onOpenChange={() => {}}>
      <DialogContent
        className="max-h-[85vh] max-w-[90vw] flex flex-col rounded-lg"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
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
          <ChangelogContent
            enabled={showBanner}
            className="flex flex-col gap-3"
          />
        </div>
        <button
          type="button"
          onClick={handleUpdate}
          className="mt-4 w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
        >
          Update App
        </button>
      </DialogContent>
    </Dialog>
  );
}
