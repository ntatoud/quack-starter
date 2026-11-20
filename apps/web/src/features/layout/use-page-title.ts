import { useEffect } from "react";

import { pageTitle } from "#/features/layout/page-title.ts";

/**
 * Titles the page with what only its data tells, such as the name of a User, once it is loaded: `title`, then the
 * pages that lead to it. Until then the title stays the one of the route's `head`, which runs before the data loads in
 * the browser.
 */
export const usePageTitle = (title: string | undefined, ...parents: ReadonlyArray<string>) => {
  const full = title === undefined ? undefined : pageTitle(title, ...parents);
  useEffect(() => {
    if (full !== undefined) document.title = full;
  }, [full]);
};
