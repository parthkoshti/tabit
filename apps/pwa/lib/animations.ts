import type { Variants } from "framer-motion";

/**
 * Mobile touch animation timing (per mobile-touch skill):
 * - Touch response: <100ms
 * - Quick actions: 150-250ms
 * - View transitions: 250-350ms
 * - Complex animations: 350-500ms
 */

/** iOS-style spring: damping 0.7, settled feel. View transitions 250-350ms. */
export const spring = {
  type: "spring" as const,
  stiffness: 320,
  damping: 28,
};

/** Material FastOutSlowIn easing - never use linear for user-initiated motion. */
export const easeOutSlowIn = [0.4, 0, 0.2, 1] as const;

/** Quick actions 150-250ms. Touch feedback. */
export const quickTransition = {
  duration: 0.2,
  ease: easeOutSlowIn,
};

/** Touch response <100ms. */
export const touchTransition = {
  duration: 0.08,
  ease: easeOutSlowIn,
};

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const transitionSpring = { transition: spring };

/** Follow Through & Overlapping: list items settle with stagger. */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

/** Squash & Stretch: buttons compress on touch. Quick actions 150-250ms. */
export const cardHover = {
  scale: 1.02,
  transition: quickTransition,
};

export const fabSpring = {
  initial: { scale: 0 },
  animate: { scale: 1 },
  transition: spring,
};
