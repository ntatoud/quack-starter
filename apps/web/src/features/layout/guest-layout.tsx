import { Outlet } from "@tanstack/react-router";

export function GuestLayout() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6">
      <p className="text-lg font-semibold">Quack</p>
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </main>
  );
}
