import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Providers } from "./providers";
import { UpdateGate } from "@/components/update-gate";
import { SplashScreenLinks } from "./SplashScreenLinks";
import { Toaster } from "@/components/ui/sonner";
import { AppLayout } from "./routes/AppLayout";
import { LoginPage } from "@/app/login/page";
import { InvitePage } from "@/app/invite/page";
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
import { NotFoundPage } from "@/app/not-found";

export function App() {
  return (
    <BrowserRouter>
      <Providers>
        <UpdateGate>
          <SplashScreenLinks />
          <div className="min-h-screen bg-background font-sans text-foreground">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/invite" element={<InvitePage />} />
              <Route path="*" element={<AppLayout />}>
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
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </div>
          <Toaster />
        </UpdateGate>
      </Providers>
    </BrowserRouter>
  );
}
