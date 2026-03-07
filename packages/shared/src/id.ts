import { createId as createCuid2, init } from "@paralleldrive/cuid2";

/** Full-length CUID2 (24 chars). Use for auth tables. */
export const createFullId = createCuid2;

export const createId = init({ length: 8 });

/** For short tokens (e.g. invite codes). Min CUID2 length is 5. */
export const createShortId = init({ length: 5 });
