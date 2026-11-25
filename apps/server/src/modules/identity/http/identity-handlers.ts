import { Api } from "@quack/contracts/api";
import { CurrentUser } from "@quack/contracts/identity/authentication";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { Identity } from "#/modules/identity/application/identity.ts";
import { Onboarding } from "#/modules/identity/application/onboarding.ts";
import { PasswordResets } from "#/modules/identity/application/password-resets.ts";
import { Users } from "#/modules/identity/application/users.ts";
import { clientIp } from "#/modules/identity/http/client-ip.ts";

export const IdentityHandlers = HttpApiBuilder.group(
  Api,
  "identity",
  Effect.fn(function* (handlers) {
    const identity = yield* Identity;
    const users = yield* Users;
    const onboarding = yield* Onboarding;
    const passwordResets = yield* PasswordResets;

    return handlers.handleAll({
      // Yielded writes and clears the session cookie itself, on the answer of the request.
      signUp: Effect.fn(function* ({ payload }) {
        return yield* identity.signUp(
          payload.email,
          payload.password,
          payload.timeZone,
          yield* clientIp,
        );
      }),
      signIn: Effect.fn(function* ({ payload }) {
        return yield* identity.signIn(payload.email, payload.password, yield* clientIp);
      }),
      // Not behind `Authentication`, which would refuse a request with no Session.
      signOut: () => identity.signOut,
      requestPasswordReset: Effect.fn(function* ({ payload }) {
        yield* passwordResets.request(payload.email, yield* clientIp);
      }),
      confirmPasswordReset: ({ payload }) =>
        passwordResets.confirm(payload.token, payload.password),
      me: () => Effect.service(CurrentUser),
      updateProfile: Effect.fn(function* ({ payload }) {
        const currentUser = yield* CurrentUser;

        return yield* users.updateProfile(currentUser.id, payload);
      }),
      updateTimeZone: Effect.fn(function* ({ payload }) {
        const currentUser = yield* CurrentUser;

        return yield* users.updateTimeZone(currentUser.id, payload.timeZone);
      }),
      completeOnboarding: Effect.fn(function* ({ payload }) {
        const currentUser = yield* CurrentUser;

        return yield* onboarding.complete(currentUser.id, payload);
      }),
    });
  }),
);
