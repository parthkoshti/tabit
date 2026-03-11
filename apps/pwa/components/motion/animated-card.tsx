"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { cardHover, quickTransition } from "@/lib/animations";

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
}

export function AnimatedCard({ children, className }: AnimatedCardProps) {
  return (
    <motion.div
      whileHover={cardHover}
      whileTap={{ scale: 0.98 }}
      transition={quickTransition}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
