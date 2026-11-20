import { Outlet, useRouteContext } from "@tanstack/react-router";

import { useSetCurrentUser } from "#/features/identity/current-user.ts";
import { OnboardingDialog } from "#/features/onboarding/onboarding-dialog.tsx";

export function AuthenticatedLayout() {
  const { currentUser } = useRouteContext({ from: "/_authenticated" });
  const setCurrentUser = useSetCurrentUser();

  return (
    <>
      <Outlet />
      {currentUser.onboardedAt === null && (
        <OnboardingDialog email={currentUser.email} onOnboarded={setCurrentUser} />
      )}
    </>
  );
}
