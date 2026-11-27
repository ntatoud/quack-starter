import { NodeCrypto } from "@effect/platform-node";
import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import {
  Email,
  type Password,
  type Role,
  User,
  type UserStatus,
} from "@quack/contracts/identity/user";
import { DateTime, Effect, Layer, Option, Redacted } from "effect";
import { Cookies, HttpClientRequest } from "effect/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api";
import type { HttpApi, HttpApiGroup } from "effect/http-api";

import { PasswordHasher, PasswordHasherArgon2, UserRepository } from "#/modules/identity/index.ts";

/** The password of every User `aUser` stores. */
export const knownPassword: Password = Redacted.make("correct horse battery staple");

// Argon2 takes tens of milliseconds by design: once for each test worker is enough.
let knownPasswordHash: string | undefined;

const hashOfKnownPassword = Effect.gen(function* () {
  knownPasswordHash ??= yield* (yield* PasswordHasher).hash(knownPassword);

  return knownPasswordHash;
}).pipe(
  Effect.provide(
    PasswordHasherArgon2.pipe(Layer.provide([NodeCrypto.layerKdf, NodeCrypto.layerSecureRandom])),
  ),
);

/**
 * A User of the test's own, stored with `knownPassword`, of its own email: no endpoint makes an Admin, nor a User of
 * any Status at once.
 */
export const aUser = Effect.fn("aUser")(function* ({
  role = "user",
  status = "active",
}: { readonly role?: Role; readonly status?: UserStatus } = {}) {
  const users = yield* UserRepository;
  const id = yield* users.nextId;

  const user = new User({
    id,
    email: Email.make(`${id}@example.com`),
    role,
    status,
    createdAt: yield* DateTime.now,
    lastSignInAt: null,
    onboardedAt: null,
    timeZone: DateTime.zoneMakeNamedUnsafe("Europe/Paris"),
    profile: null,
  });

  yield* users.create(user, yield* hashOfKnownPassword).pipe(Effect.orDie);

  return user;
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
