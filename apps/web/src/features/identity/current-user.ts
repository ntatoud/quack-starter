import { User } from "@quack/contracts/identity/user";
import { type QueryClient, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { appendResponseHeader, getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { Schema } from "effect";

import { fetchCurrentUser } from "#/features/identity/fetch-current-user.server.ts";
import { serverEnv } from "#/env/server.ts";

const encodeUser = Schema.encodeSync(User);

/**
 * The Current User of the request, or `null` when it carries no valid Session.
 *
 * A server function, since the Session cookie is `HttpOnly` and a server render has no browser to send it:
 * the web server relays the cookie of the request to the API, and the API's `Set-Cookie` back to the browser.
 */
const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const { user, setCookie } = await fetchCurrentUser({
    apiUrl: serverEnv.API_URL,
    cookie: getRequestHeader("cookie"),
    clientIp: getRequestIP(),
  });
  // Appended, not set: setting the header would replace the cookies already on the response.
  if (setCookie.length > 0) appendResponseHeader("set-cookie", setCookie);
  // Encoded, since it crosses from the web server to the browser.
  return user === null ? null : encodeUser(user);
});

/**
 * The Current User in the query cache, under the key `["me"]`. The root route loads it before every navigation
 * and exposes it as `context.currentUser`: read it there, in a `beforeLoad` or with `useRouteContext`.
 */
export const currentUserQueryOptions = queryOptions({
  queryKey: ["me"],
  queryFn: () => getCurrentUser(),
});

/**
 * Writes who the Current User is now in the cache, and drops every other query it holds:
 * they are the data of the Current User before, which the next one must not see.
 *
 * A component calls `useSetCurrentUser`, which also tells the router.
 */
export const setCurrentUserData = (queryClient: QueryClient, user: typeof User.Encoded | null) => {
  const [currentUserKey] = currentUserQueryOptions.queryKey;
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== currentUserKey });
  queryClient.setQueryData(currentUserQueryOptions.queryKey, user);
};

/**
 * Tells the app who the Current User is now: after a sign-up or a sign-in, the User the API answered,
 * and after a sign-out, `null`.
 * It updates the cache, then invalidates the router, so every route's `context.currentUser` follows.
 */
export const useSetCurrentUser = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return async (user: User | null) => {
    setCurrentUserData(queryClient, user === null ? null : encodeUser(user));
    await router.invalidate();
  };
};
