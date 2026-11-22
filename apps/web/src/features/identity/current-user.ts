import { User } from "@quack/contracts/identity/user";
import { type QueryClient, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { appendResponseHeader, getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { Schema } from "effect";

import { fetchCurrentUser } from "#/features/identity/fetch-current-user.server.ts";
import { serverEnv } from "#/env/server.ts";

const encodeUser = Schema.encodeSync(User);

const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const { user, setCookie } = await fetchCurrentUser({
    apiUrl: serverEnv.API_URL,
    cookie: getRequestHeader("cookie"),
    clientIp: getRequestIP(),
  });

  // Appended, not set: setting the header would replace the cookies already on the response.
  if (setCookie.length > 0) appendResponseHeader("set-cookie", setCookie);

  return user === null ? null : encodeUser(user);
});

export const currentUserQueryOptions = queryOptions({
  queryKey: ["me"],
  queryFn: () => getCurrentUser(),
});

/** Drops the queries of the User before. */
export const setCurrentUserData = (queryClient: QueryClient, user: typeof User.Encoded | null) => {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== currentUserQueryOptions.queryKey[0],
  });
  queryClient.setQueryData(currentUserQueryOptions.queryKey, user);
};

export const useSetCurrentUser = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return async (user: User | null) => {
    setCurrentUserData(queryClient, user === null ? null : encodeUser(user));
    await router.invalidate();
  };
};

/** After a change to the Current User's own data: the other queries stay, since they belong to the same User. */
export const useUpdateCurrentUser = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return async (user: User) => {
    queryClient.setQueryData(currentUserQueryOptions.queryKey, encodeUser(user));
    await router.invalidate();
  };
};
