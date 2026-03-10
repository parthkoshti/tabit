"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { cardHover } from "@/lib/animations";

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
}

export function AnimatedCard({ children, className }: AnimatedCardProps) {
  return (
    <motion.div
      whileHover={cardHover}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
