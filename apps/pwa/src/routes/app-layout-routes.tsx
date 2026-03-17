import { Route } from "react-router-dom";
import { NotFoundPage } from "@/app/not-found";
import { AppPage } from "@/app/(app)/page";
import { OnboardingPage } from "@/app/(app)/onboarding/page";
import { TabsPage } from "@/app/(app)/tabs/page";
import { CreateTabPage } from "@/app/(app)/tabs/create/page";
import { TabPage } from "@/app/(app)/tabs/[tabId]/page";
import { TabManagePage } from "@/app/(app)/tabs/[tabId]/manage/page";
import { TabMembersPage } from "@/app/(app)/tabs/[tabId]/members/page";
import { ExpensePage } from "@/app/(app)/tabs/[tabId]/expenses/[expenseId]/page";
import { SettlementPage } from "@/app/(app)/tabs/[tabId]/settlements/[settlementId]/page";
import { FriendsPage } from "@/app/(app)/friends/page";
import { AddFriendPage } from "@/app/(app)/friends/addFriend/page";
import { AddByQrPage } from "@/app/(app)/friends/add-by-qr/page";
import { ActivityPage } from "@/app/(app)/activity/page";
import { MePage } from "@/app/(app)/me/page";
import { LogExpensePage } from "@/app/(app)/expense/new/page";

export const appLayoutRoutes = (
  <>
    <Route index element={<AppPage />} />
    <Route path="onboarding" element={<OnboardingPage />} />
    <Route path="tabs" element={<TabsPage />} />
    <Route path="tabs/create" element={<CreateTabPage />} />
    <Route path="tabs/:tabId" element={<TabPage />} />
    <Route path="tabs/:tabId/manage" element={<TabManagePage />} />
    <Route path="tabs/:tabId/members" element={<TabMembersPage />} />
    <Route
      path="tabs/:tabId/expenses/:expenseId"
      element={<ExpensePage />}
    />
    <Route
      path="tabs/:tabId/settlements/:settlementId"
      element={<SettlementPage />}
    />
    <Route path="friends" element={<FriendsPage />} />
    <Route path="friends/addFriend" element={<AddFriendPage />} />
    <Route path="friends/add-by-qr" element={<AddByQrPage />} />
    <Route path="activity" element={<ActivityPage />} />
    <Route path="me" element={<MePage />} />
    <Route path="expense/new" element={<LogExpensePage />} />
    <Route path="*" element={<NotFoundPage />} />
  </>
);
