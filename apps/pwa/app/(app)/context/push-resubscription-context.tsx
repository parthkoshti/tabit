"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "push_resubscription_required";

function getStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setStored(value: boolean) {
  try {
    if (value) {
      localStorage.setItem(STORAGE_KEY, "1");
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

const PushResubscriptionContext = createContext<boolean>(false);
const PushResubscriptionSetterContext = createContext<
  ((value: boolean) => void) | null
>(null);

export function PushResubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [needsResubscription, setNeedsResubscriptionState] = useState(false);

  useEffect(() => {
    setNeedsResubscriptionState(getStored());
  }, []);

  const setNeedsResubscription = useCallback((value: boolean) => {
    setNeedsResubscriptionState(value);
    setStored(value);
  }, []);

  return (
    <PushResubscriptionContext.Provider value={needsResubscription}>
      <PushResubscriptionSetterContext.Provider value={setNeedsResubscription}>
        {children}
      </PushResubscriptionSetterContext.Provider>
    </PushResubscriptionContext.Provider>
  );
}

export function useNeedsPushResubscription() {
  return useContext(PushResubscriptionContext);
}

export function useSetPushResubscriptionRequired() {
  return useContext(PushResubscriptionSetterContext);
}
