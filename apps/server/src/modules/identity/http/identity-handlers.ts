import { Api } from "@quack/contracts/api";
import { CurrentUser, sessionCookie } from "@quack/contracts/identity/authentication";
import { Me } from "@quack/contracts/identity/user";
import { Effect, Option } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { EmailChanges } from "#/modules/identity/application/email-changes.ts";
import { Identity } from "#/modules/identity/application/identity.ts";
import { PasswordResets } from "#/modules/identity/application/password-resets.ts";
import { clientIp } from "#/modules/identity/http/client-ip.ts";
import { SessionCookie } from "#/modules/identity/http/session-cookie.ts";

export const IdentityHandlers = HttpApiBuilder.group(
  Api,
  "identity",
  Effect.fn(function* (handlers) {
    const identity = yield* Identity;
    const cookie = yield* SessionCookie;
    const passwordResets = yield* PasswordResets;
    const emailChanges = yield* EmailChanges;

    return handlers.handleAll({
      signUp: Effect.fn(function* ({ payload }) {
        const { user, session } = yield* identity.signUp(
          payload.email,
          payload.password,
          payload.timeZone,
          yield* clientIp,
        );

        yield* cookie.set(session);

        return user;
      }),
      signIn: Effect.fn(function* ({ payload }) {
        const { user, session } = yield* identity.signIn(
          payload.email,
          payload.password,
          yield* clientIp,
        );

        yield* cookie.set(session);

        return user;
      }),
      // Not behind `Authentication`, which would refuse a request with no Session.
      signOut: Effect.fn(function* () {
        yield* identity.signOut(yield* HttpApiBuilder.securityDecode(sessionCookie));
        yield* cookie.clear;
      }),
      requestPasswordReset: Effect.fn(function* ({ payload }) {
        yield* passwordResets.request(payload.email, yield* clientIp);
      }),
      confirmPasswordReset: ({ payload }) =>
        passwordResets.confirm(payload.token, payload.password),
      confirmEmailChange: ({ payload }) => emailChanges.confirm(payload.token),
      me: Effect.fn(function* () {
        const currentUser = yield* CurrentUser;
        const pendingEmail = yield* emailChanges.pendingEmail(currentUser.id);

        return new Me({ ...currentUser, pendingEmail: Option.getOrNull(pendingEmail) });
      }),
      requestEmailChange: Effect.fn(function* ({ payload }) {
        const currentUser = yield* CurrentUser;

        yield* emailChanges.request(currentUser.id, payload.newEmail, payload.password);
      }),
      cancelEmailChange: Effect.fn(function* () {
        const currentUser = yield* CurrentUser;

        yield* emailChanges.cancel(currentUser.id);
      }),
    });
  }),
);
