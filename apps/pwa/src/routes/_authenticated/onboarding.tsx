import { createFileRoute } from "@tanstack/react-router";
import { OnboardingPage } from "@/app/(app)/onboarding/page";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});
