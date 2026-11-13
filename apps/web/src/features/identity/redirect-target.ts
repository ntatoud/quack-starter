// Any origin no page of the app has: a `redirect` that leaves it leads to another site.
const appOrigin = "http://app.invalid";

/**
 * Where a sign-in leads: the `redirect` of the sign-in page when it is a path of this app, `/` otherwise.
 * A link to the sign-in page can carry any `redirect`, so it must not send the User to another site.
 *
 * The browser's own URL parser decides, since it is what follows the link: it reads `//host` and `/\host`
 * as another host, and drops the tabs and line breaks that would hide them.
 * The answer is the path as the parser read it, with its search and hash: the parser resolves `/.//host` to the path
 * `//host`, which read again would be another host, so a path that starts with two slashes is refused too.
 */
export const redirectTarget = (redirect: string | undefined): string => {
  if (redirect === undefined || !redirect.startsWith("/")) return "/";
  if (!URL.canParse(redirect, appOrigin)) return "/";
  const url = new URL(redirect, appOrigin);
  if (url.origin !== appOrigin || url.pathname.startsWith("//")) return "/";
  return url.pathname + url.search + url.hash;
};
