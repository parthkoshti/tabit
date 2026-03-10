"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { appConfig } from "@/app/config";

export function LoadingScreen() {
  return (
    <motion.div
      className="flex min-h-screen items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Image
        src={appConfig.icons.md.src}
        alt={appConfig.name}
        width={128}
        height={128}
        priority
        className="h-32 w-32"
      />
    </motion.div>
  );
}
