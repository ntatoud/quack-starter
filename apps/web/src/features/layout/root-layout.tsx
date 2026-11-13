import { Outlet, useRouteContext } from "@tanstack/react-router";

import { AppHeader } from "#/features/identity/app-header.tsx";

export function RootLayout() {
  const { currentUser } = useRouteContext({ from: "__root__" });

  return (
    <>
      <AppHeader currentUser={currentUser} />
      <main className="mx-auto max-w-xl p-6 pt-16">
        <Outlet />
      </main>
    </>
  );
}
