import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import { useEffect } from "react";

import { SignOutButton } from "#/features/identity/sign-out-button.tsx";
import { sections } from "#/features/settings/settings-layout.tsx";

/**
 * The sections of the settings on a phone, where the tab bar leads, and a way to sign out, which a wider screen does
 * from the user menu. A wider screen shows the menu of the sections next to the first one instead.
 */
export function SettingsHome() {
  const navigate = useNavigate();

  // Read in an effect, not with `useIsMobile`: the server render, which knows no width, would take every screen for a wide one.
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      void navigate({ to: "/app/settings/profile", replace: true });
    }
  }, [navigate]);

  return (
    <div className="flex flex-col gap-6 md:hidden">
      <nav aria-label="Settings">
        <ul className="divide-y rounded-xl border">
          {sections.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex h-12 items-center gap-3 px-5 text-sm font-medium outline-hidden focus-visible:bg-accent active:bg-accent [&_svg]:size-4 [&_svg]:shrink-0"
              >
                <Icon aria-hidden className="text-muted-foreground" />
                {label}
                <ChevronRightIcon aria-hidden className="ml-auto text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <SignOutButton />
    </div>
  );
}
