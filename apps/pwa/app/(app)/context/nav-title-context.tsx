"use client";

import { useNavStore } from "@/lib/stores/nav-store";

export type { NavTitleConfig } from "@/lib/stores/nav-store";

export function useNavTitle() {
  return useNavStore.getState().setNavPage;
}

export function useNavTitleConfig() {
  return useNavStore((s) => s.navPage);
}
