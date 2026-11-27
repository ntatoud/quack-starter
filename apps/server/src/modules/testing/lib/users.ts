import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import {
  Email,
  type Password,
  User,
  UserId,
  type UserStatus,
} from "@quack/contracts/identity/user";
import { DateTime, Effect, Option, Redacted } from "effect";
import { Cookies, HttpClientRequest } from "effect/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api";
import type { HttpApi, HttpApiGroup } from "effect/http-api";

import { hashPassword } from "#/modules/users/lib/password.ts";
import { userQueries } from "#/modules/users/lib/user-queries.ts";

export const knownPassword: Password = Redacted.make("correct horse battery staple");

// Argon2 takes tens of milliseconds by design: once for each test worker is enough.
let knownPasswordHash: string | undefined;

const hashOfKnownPassword = Effect.gen(function* () {
  knownPasswordHash ??= yield* hashPassword(knownPassword);

  return knownPasswordHash;
});

/**
 * A User of the test's own, stored with `knownPassword`, of its own email unless `fields` gives one: no endpoint
 * makes an Admin, nor a User of any Status or of any date at once.
 */
export const aUser = Effect.fn("aUser")(function* (
  fields: Partial<ConstructorParameters<typeof User>[0]> = {},
) {
  const { create } = yield* userQueries;
  const id = fields.id ?? UserId.make(crypto.randomUUID());

  const user = new User({
    id,
    email: Email.make(`${id}@example.com`),
    role: "user",
    status: "active",
    createdAt: yield* DateTime.now,
    lastSignInAt: null,
    onboardedAt: null,
    timeZone: DateTime.zoneMakeNamedUnsafe("Europe/Paris"),
    profile: null,
    ...fields,
  });

  yield* create(user, yield* hashOfKnownPassword).pipe(Effect.orDie);

  return user;
});

/** Sets the Status of a stored User, as an Admin would, but to any Status, and with no Admin to ask. */
export const setStatus = Effect.fn("setStatus")(function* (id: UserId, status: UserStatus) {
  const { findById, update } = yield* userQueries;
  const user = yield* Effect.flatMap(findById(id), Effect.fromOption).pipe(Effect.orDie);

  yield* update(new User({ ...user, status }));
});

export type ApiGroups = typeof Api extends HttpApi.HttpApi<string, infer Groups> ? Groups : never;

const withCookie = (cookie: string | undefined) =>
  HttpApiMiddleware.layerClient(Authentication, ({ next, request }) =>
    next(cookie === undefined ? request : HttpClientRequest.setHeader(request, "cookie", cookie)),
  );

/** A client of the `groups` of the `Api`, with the Session `user` opens by signing in with `knownPassword`. */
export const signedIn = <
  const Identifiers extends ReadonlyArray<HttpApiGroup.Identifier<ApiGroups>>,
>(
  user: User,
  groups: Identifiers,
) =>
  Effect.gen(function* () {
    const visitor = yield* HttpApiTest.groups(Api, ["identity"]).pipe(
      Effect.provide(withCookie(undefined)),
    );

    const [, response] = yield* visitor.identity.signIn({
      payload: { email: user.email, password: knownPassword },
      responseMode: "decoded-and-response",
    });

    const session = Cookies.getValue(response.cookies, "session");

    return yield* HttpApiTest.groups(Api, groups).pipe(
      Effect.provide(
        withCookie(Option.getOrUndefined(Option.map(session, (token) => `session=${token}`))),
      ),
    );
  });
