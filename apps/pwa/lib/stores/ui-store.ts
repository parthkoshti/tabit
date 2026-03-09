import { create } from "zustand";

interface UIState {
  selectedTabId: string | null;
  setSelectedTabId: (id: string | null) => void;
  isAddExpenseOpen: boolean;
  setIsAddExpenseOpen: (open: boolean) => void;
  isSettleUpOpen: boolean;
  setIsSettleUpOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedTabId: null,
  setSelectedTabId: (id) => set({ selectedTabId: id }),
  isAddExpenseOpen: false,
  setIsAddExpenseOpen: (open) => set({ isAddExpenseOpen: open }),
  isSettleUpOpen: false,
  setIsSettleUpOpen: (open) => set({ isSettleUpOpen: open }),
}));
