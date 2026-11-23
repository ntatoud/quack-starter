import {
  type EmailAlreadyTaken,
  InvalidCredentials,
  type TooManyAttempts,
  Unauthenticated,
} from "@quack/contracts/identity/identity-errors";
import { type Email, type Password, type TimeZone, User } from "@quack/contracts/identity/user";
import { Context, DateTime, Effect, Layer, Option, Redacted } from "effect";
import { Digest, SecureRandom } from "effect/crypto";
import { Base64Url } from "effect/encoding";

import {
  AttemptCounter,
  AttemptLimiter,
  type ClientIp,
} from "#/modules/identity/domain/attempt-limiter.ts";
import { sha256Hex } from "#/modules/identity/application/sha256-hex.ts";
import { PasswordHasher } from "#/modules/identity/domain/password-hasher.ts";
import {
  expiryFrom,
  extension,
  isExpired,
  type Session,
  sessionTokenBytes,
} from "#/modules/identity/domain/session.ts";
import { SessionStore } from "#/modules/identity/domain/session-store.ts";
import { canSignIn, signedIn } from "#/modules/identity/domain/user.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

export interface OpenedSession {
  readonly token: Redacted.Redacted<string>;
  readonly expiresAt: DateTime.Utc;
}

export class Identity extends Context.Service<
  Identity,
  {
    signUp(
      email: Email,
      password: Password,
      timeZone: TimeZone,
      ip: ClientIp,
    ): Effect.Effect<
      { readonly user: User; readonly session: OpenedSession },
      EmailAlreadyTaken | TooManyAttempts
    >;
    signIn(
      email: Email,
      password: Password,
      ip: ClientIp,
    ): Effect.Effect<
      { readonly user: User; readonly session: OpenedSession },
      InvalidCredentials | TooManyAttempts
    >;
    signOut(token: Redacted.Redacted<string>): Effect.Effect<void>;
    authenticate(
      token: Redacted.Redacted<string>,
    ): Effect.Effect<
      { readonly user: User; readonly extendedUntil: Option.Option<DateTime.Utc> },
      Unauthenticated
    >;
  }
>()("@quack/server/identity/Identity") {
  static readonly layer = Layer.effect(
    Identity,
    Effect.gen(function* () {
      const users = yield* UserRepository;
      const sessions = yield* SessionStore;
      const hasher = yield* PasswordHasher;
      const limiter = yield* AttemptLimiter;
      const random = yield* SecureRandom.SecureRandom;
      const digest = yield* Digest.Digest;

      const hashToken = (token: Redacted.Redacted<string>) =>
        sha256Hex(digest, Redacted.value(token));

      const openSession = Effect.fn("Identity.openSession")(function* (user: User) {
        const token = Redacted.make(Base64Url.encode(yield* random.randomBytes(sessionTokenBytes)));

        const session: Session = {
          tokenHash: yield* hashToken(token),
          userId: user.id,
          expiresAt: expiryFrom(yield* DateTime.now),
        };

        yield* sessions.save(session);

        return { token, expiresAt: session.expiresAt } satisfies OpenedSession;
      });

      return Identity.of({
        signUp: Effect.fn("Identity.signUp")(function* (email, password, timeZone, ip) {
          // Counted before it is known to succeed: one that fails costs a hash, and tells whether a User has the email.
          yield* limiter.take([AttemptCounter.signUpsOfIp(ip)]);
          const now = yield* DateTime.now;

          const user = new User({
            id: yield* users.nextId,
            email,
            role: "user",
            status: "active",
            createdAt: now,
            lastSignInAt: now,
            onboardedAt: null,
            profile: null,
            timeZone,
          });

          yield* users.create(user, yield* hasher.hash(password));

          return { user, session: yield* openSession(user) };
        }),
        signIn: Effect.fn("Identity.signIn")(function* (email, password, ip) {
          const failuresOfEmail = AttemptCounter.signInFailuresOfEmail(email);
          const failuresOfIp = AttemptCounter.signInFailuresOfIp(ip);
          // Before the lookup and the hash, so a refusal costs nothing and says nothing of the email.
          // Counted as a failure up front: sign-ins arriving at once would all pass before the first one is counted.
          yield* limiter.take([failuresOfEmail, failuresOfIp]);

          const found = yield* users.findByEmail(email);

          if (Option.isNone(found)) {
            // The slow step of a sign-in, done for nothing: without it, a fast answer would say that no User has this email.
            yield* hasher.hash(password);

            return yield* new InvalidCredentials();
          }

          const { passwordHash } = found.value;

          // After the password: whoever does not know it must not learn the status of the User.
          if (!(yield* hasher.verify(password, passwordHash)) || !canSignIn(found.value.user)) {
            return yield* new InvalidCredentials();
          }

          // The address only gives this attempt back: signing into one's own account must not clear
          // the failures on the emails of others.
          yield* limiter.reset(failuresOfEmail);
          yield* limiter.giveBack(failuresOfIp);
          const user = signedIn(found.value.user, yield* DateTime.now);
          yield* users.update(user);

          return { user, session: yield* openSession(user) };
        }),
        signOut: Effect.fn("Identity.signOut")(function* (token) {
          yield* sessions.remove(yield* hashToken(token));
        }),
        authenticate: Effect.fn("Identity.authenticate")(function* (token) {
          const now = yield* DateTime.now;
          const tokenHash = yield* hashToken(token);
          const session = yield* sessions.findByTokenHash(tokenHash);

          if (Option.isNone(session)) {
            return yield* new Unauthenticated();
          }

          if (isExpired(session.value, now)) {
            // Nothing sweeps the store: a Session that has expired leaves it when it is read.
            yield* sessions.remove(tokenHash);

            return yield* new Unauthenticated();
          }

          const user = yield* users.findById(session.value.userId);

          if (Option.isNone(user)) {
            return yield* new Unauthenticated();
          }

          if (!canSignIn(user.value)) {
            // A User suspended after signing in loses their Session at their next request.
            yield* sessions.remove(tokenHash);

            return yield* new Unauthenticated();
          }

          const extendedUntil = extension(session.value, now);

          if (Option.isSome(extendedUntil)) {
            yield* sessions.extend(tokenHash, extendedUntil.value);
          }

          return { user: user.value, extendedUntil };
        }),
      });
    }),
  );
}
