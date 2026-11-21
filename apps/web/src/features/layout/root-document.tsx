import { HeadContent, Scripts } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import type { ReactNode } from "react";

import { usePreference } from "#/features/preferences/use-preference.ts";

// Out of the production bundle: the build replaces import.meta.env.DEV with false and drops the import.
const Devtools = import.meta.env.DEV ? lazy(() => import("#/features/layout/devtools.tsx")) : null;

export function RootDocument({ children }: { children: ReactNode }) {
  const theme = usePreference("theme");

  return (
    <html lang="en" className={theme}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {Devtools && (
          <Suspense>
            <Devtools />
          </Suspense>
        )}
        <Scripts />
      </body>
    </html>
  );
}
