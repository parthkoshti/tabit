import { createRouterUtils } from "@orpc/tanstack-query";
import { orpcClient } from "./orpc-client";

export const orpc = orpcClient;
export const orpcUtils = createRouterUtils(orpcClient);
