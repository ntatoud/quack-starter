import { Outlet } from "@tanstack/react-router";

import { Logo } from "#/features/layout/logo.tsx";

export function GuestLayout() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6">
      <Logo className="text-lg" />
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </main>
  );
}
