import { motion } from "framer-motion";
import { appConfig } from "@/src/config";
import { quickTransition } from "@/lib/animations";

export function LoadingScreen() {
  return (
    <motion.div
      className="flex min-h-screen items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={quickTransition}
    >
      <img
        src={appConfig.icons.md.src}
        alt={appConfig.name}
        width={128}
        height={128}
        className="h-32 w-32"
      />
    </motion.div>
  );
}
