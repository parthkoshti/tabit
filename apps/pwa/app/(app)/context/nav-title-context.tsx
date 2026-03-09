"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

export type NavTitleConfig = {
  title: string;
  backHref: string;
  avatarUserIds?: string[];
  /** When set (direct tab), renders "Tab with <avatar> <name>" */
  avatarDisplayName?: string;
  /** Icon to show in navbar next to title */
  icon?: React.ReactNode;
};

const NavTitleContext = createContext<NavTitleConfig | null>(null);
const NavTitleSetterContext = createContext<
  ((config: NavTitleConfig | null) => void) | null
>(null);

export function NavTitleProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<NavTitleConfig | null>(null);
  const setter = useCallback((config: NavTitleConfig | null) => {
    setConfig(config);
  }, []);

  return (
    <NavTitleContext.Provider value={config}>
      <NavTitleSetterContext.Provider value={setter}>
        {children}
      </NavTitleSetterContext.Provider>
    </NavTitleContext.Provider>
  );
}

export function useNavTitle() {
  return useContext(NavTitleSetterContext);
}

export function useNavTitleConfig() {
  return useContext(NavTitleContext);
}
