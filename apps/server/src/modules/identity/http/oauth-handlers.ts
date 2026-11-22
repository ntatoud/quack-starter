import { Api } from "@quack/contracts/api";
import { CurrentUser } from "@quack/contracts/identity/authentication";
import { AuthorizationRequest } from "@quack/contracts/oauth/authorization-request";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { AuthorizationRequests } from "#/modules/identity/application/authorization-requests.ts";
import { CsrfTokens } from "#/modules/identity/http/csrf-tokens.ts";

export const OAuthHandlers = HttpApiBuilder.group(
  Api,
  "oauth",
  Effect.fn(function* (handlers) {
    const requests = yield* AuthorizationRequests;
    const csrf = yield* CsrfTokens;

    return handlers.handleAll({
      checkAuthorization: Effect.fn(function* ({ payload }) {
        const user = yield* CurrentUser;
        const prompt = yield* requests.check(payload, user.id);
        return new AuthorizationRequest({ ...prompt, csrfToken: yield* csrf.ofSession });
      }),
      approveAuthorization: Effect.fn(function* ({ payload: { csrfToken, ...params } }) {
        yield* csrf.verify(csrfToken);
        const user = yield* CurrentUser;
        return { redirectTo: yield* requests.approve(params, user.id) };
      }),
      denyAuthorization: Effect.fn(function* ({ payload: { csrfToken, ...params } }) {
        yield* csrf.verify(csrfToken);
        return { redirectTo: yield* requests.deny(params) };
      }),
    });
  }),
);
