// Any origin no page of the app has: a `redirect` that leaves it leads to another site.
const appOrigin = "http://app.invalid";

/**
 * The browser's own URL parser decides, since it is what follows the link: it reads `//host` and `/\host` as another
 * host, and drops the tabs and line breaks that would hide them. It resolves `/.//host` to the path `//host`, which
 * read again is another host, so a path that starts with two slashes is refused too.
 */
export const redirectTarget = (redirect: string | undefined): string => {
  if (redirect === undefined || !redirect.startsWith("/")) return "/";
  if (!URL.canParse(redirect, appOrigin)) return "/";
  const url = new URL(redirect, appOrigin);
  if (url.origin !== appOrigin || url.pathname.startsWith("//")) return "/";
  return url.pathname + url.search + url.hash;
};

export const signInLocation = (href: string) =>
  ({ to: "/sign-in", search: { redirect: href } }) as const;
