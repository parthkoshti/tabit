"use client";

import { createContext, useCallback, useContext, useState } from "react";

const DisplayPathnameContext = createContext<string>("");
const DisplayPathnameSetterContext = createContext<
  ((pathname: string) => void) | null
>(null);

export function DisplayPathnameProvider({
  children,
  pathname,
}: {
  children: React.ReactNode;
  pathname: string;
}) {
  const [displayPathname, setDisplayPathname] = useState(pathname);
  const setter = useCallback((pathname: string) => {
    setDisplayPathname(pathname);
  }, []);

  return (
    <DisplayPathnameContext.Provider value={displayPathname}>
      <DisplayPathnameSetterContext.Provider value={setter}>
        {children}
      </DisplayPathnameSetterContext.Provider>
    </DisplayPathnameContext.Provider>
  );
}

export function useDisplayPathname() {
  return useContext(DisplayPathnameContext);
}

export function useDisplayPathnameSetter() {
  return useContext(DisplayPathnameSetterContext);
}
