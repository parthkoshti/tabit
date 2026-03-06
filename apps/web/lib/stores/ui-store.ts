import { create } from "zustand";

interface UIState {
  selectedGroupId: string | null;
  setSelectedGroupId: (id: string | null) => void;
  isAddExpenseOpen: boolean;
  setIsAddExpenseOpen: (open: boolean) => void;
  isSettleUpOpen: boolean;
  setIsSettleUpOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedGroupId: null,
  setSelectedGroupId: (id) => set({ selectedGroupId: id }),
  isAddExpenseOpen: false,
  setIsAddExpenseOpen: (open) => set({ isAddExpenseOpen: open }),
  isSettleUpOpen: false,
  setIsSettleUpOpen: (open) => set({ isSettleUpOpen: open }),
}));
