import { useParams, useLocation, Link } from "@/lib/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { fabSpring } from "@/lib/animations";

export function AddExpenseButton() {
  const params = useParams<{ tabId?: string }>();
  const { pathname } = useLocation();
  const tabIdFromParams =
    params?.tabId ?? (pathname.match(/^\/tabs\/([^/]+)/)?.[1] ?? null);
  const href = tabIdFromParams
    ? `/expense/new?tabId=${tabIdFromParams}`
    : "/expense/new";

  return (
    <div className="flex flex-1 items-center justify-center px-1 -my-4">
      <motion.div {...fabSpring} whileTap={{ scale: 0.95 }}>
        <Button
          variant="default"
          className="size-18 rounded-full border border-border/40 p-0 shadow-md ring-2 ring-background transition-all duration-200 hover:shadow-lg [&_svg]:size-7"
          asChild
        >
          <Link to={href}>
            <Plus />
          </Link>
        </Button>
      </motion.div>
    </div>
  );
}
