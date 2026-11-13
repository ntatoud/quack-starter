import { HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** The HTML document around every page. */
export function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
