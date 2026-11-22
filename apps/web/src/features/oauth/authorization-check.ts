import { AuthorizationRequestParams } from "@quack/contracts/oauth/authorization-request";
import type { QueryClient } from "@tanstack/react-query";
import { Struct } from "effect";

import { api } from "#/lib/api.ts";

const paramNames = Struct.keys(AuthorizationRequestParams.fields);

export const authorizationParamsOf = (searchStr: string): AuthorizationRequestParams => {
  const search = new URLSearchParams(searchStr);

  return Object.fromEntries(
    paramNames.flatMap((name) => {
      const value = search.get(name);

      return value === null ? [] : [[name, value]];
    }),
  );
};

export const authorizationCheckOptions = (params: AuthorizationRequestParams) =>
  api.oauth.checkAuthorization.queryOptions({
    input: { payload: params },
    // A refused request is refused again; the CSRF token lasts as long as the Session.
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

/**
 * Where to send the User when Quack remembers their consent: the request is approved before the page
 * shows. `undefined` when the page must ask, which is also what a failed check or approval leads to,
 * so the page shows the failure or asks.
 */
export const rememberedConsentRedirect = async (
  queryClient: QueryClient,
  params: AuthorizationRequestParams,
) => {
  const request = await queryClient
    .ensureQueryData(authorizationCheckOptions(params))
    .catch(() => undefined);

  if (request?.consentRemembered !== true) return undefined;

  // Through the client's cache, as `useMutation` would: its handlers see the call.
  return (
    queryClient
      .getMutationCache()
      .build(queryClient, api.oauth.approveAuthorization.mutationOptions())
      // What the Grant holds, not only what is asked: approving sets the Grant to exactly what is approved.
      .execute({
        payload: {
          ...params,
          csrfToken: request.csrfToken,
          permissions: request.grantedPermissions ?? request.permissions,
        },
      })
      .then(
        ({ redirectTo }) => redirectTo,
        () => undefined,
      )
  );
};
