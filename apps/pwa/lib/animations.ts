import type { Variants } from "framer-motion";

export const spring = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const transitionSpring = { transition: spring };

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.05 },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export const cardHover = {
  scale: 1.02,
  transition: { duration: 0.2 },
};

export const fabSpring = {
  initial: { scale: 0 },
  animate: { scale: 1 },
  transition: spring,
};
