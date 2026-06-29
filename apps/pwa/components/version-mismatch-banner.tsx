import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUpdateBanner } from "@/app/(app)/context/update-banner-context";

export function VersionMismatchBanner() {
  const { needRefresh, updateServiceWorker } = useUpdateBanner();

  return (
    <Dialog open={needRefresh} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-[90vw] flex flex-col rounded-lg"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Update available</DialogTitle>
          <p className="text-sm text-muted-foreground">
            A new version of Tab is ready.
          </p>
        </DialogHeader>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="mt-2 w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
        >
          Update now
        </button>
      </DialogContent>
    </Dialog>
  );
}
