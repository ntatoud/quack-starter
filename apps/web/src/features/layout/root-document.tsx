import { HeadContent, Scripts } from "@tanstack/react-router";
import { Preferences, usePreference } from "@ui-sdk/react/preferences";
import { lazy, Suspense } from "react";
import type { ReactNode } from "react";

import { usePreferences } from "#/features/preferences/preferences.ts";

// Out of the production bundle: the build replaces import.meta.env.DEV with false and drops the import.
const Devtools = import.meta.env.DEV ? lazy(() => import("#/features/layout/devtools.tsx")) : null;

export function RootDocument({ children }: { children: ReactNode }) {
  const { colorScheme, sidebarSide } = usePreferences();
  const { value: colorSchemeValue } = usePreference(colorScheme);

  return (
    // `Preferences` keeps the attribute current in the browser; the server render, which runs no effect, writes it here.
    <html lang="en" data-color-scheme={colorSchemeValue}>
      <head>
        <HeadContent />
      </head>
      <body>
        <Preferences preferences={[colorScheme, sidebarSide]}>
          {children}
          {Devtools && (
            <Suspense>
              <Devtools />
            </Suspense>
          )}
        </Preferences>
        <Scripts />
      </body>
    </html>
  );
}
