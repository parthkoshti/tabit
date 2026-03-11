import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, Routes } from "react-router-dom";
import { pageTransition, transitionSpring } from "@/lib/animations";
import { appLayoutRoutes } from "@/src/routes/app-layout-routes";
import { useNavStore } from "@/lib/stores/nav-store";

function createLocation(pathname: string) {
  return { pathname, search: "", hash: "", key: "", state: null };
}

export function PageTransition() {
  const { pathname } = useLocation();
  const setDisplayPathname = useNavStore((s) => s.setDisplayPathname);

  // Update navbar immediately when pathname changes - prevents flash from late sync
  useEffect(() => {
    setDisplayPathname(pathname);
  }, [pathname, setDisplayPathname]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          variants={pageTransition}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transitionSpring.transition}
          className="absolute inset-0 overflow-auto opacity-0"
        >
          <Routes location={createLocation(pathname)}>{appLayoutRoutes}</Routes>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
