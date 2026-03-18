import { defineProject, mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.js";

export default mergeConfig(
  shared,
  defineProject({
    test: {
      name: "api",
      setupFiles: ["./src/test/setup.ts"],
    },
  }),
);
