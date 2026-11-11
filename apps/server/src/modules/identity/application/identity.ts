import {
  type EmailAlreadyTaken,
  InvalidCredentials,
  type TooManyAttempts,
  Unauthenticated,
} from "@quack/contracts/identity/identity-errors";
import { type Email, type Password, User } from "@quack/contracts/identity/user";
import { Context, DateTime, Effect, Layer, Option, Redacted } from "effect";
import { Digest, SecureRandom } from "effect/crypto";
import { Base64Url } from "effect/encoding";

import {
  type AttemptCounter,
  AttemptLimiter,
  type ClientIp,
} from "#/modules/identity/domain/attempt-limiter.ts";
import { PasswordHasher } from "#/modules/identity/domain/password-hasher.ts";
import {
  expiryFrom,
  extension,
  isExpired,
  type Session,
  sessionTokenBytes,
} from "#/modules/identity/domain/session.ts";
import { SessionStore } from "#/modules/identity/domain/session-store.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

/** A Session as its User holds it: the token, which the server does not keep, and when it stops working. */
export interface OpenedSession {
  readonly token: Redacted.Redacted<string>;
  readonly expiresAt: DateTime.Utc;
}

/** Use cases of the identity context. Depends on the domain only. */
export class Identity extends Context.Service<
  Identity,
  {
    /**
     * Creates the User and opens their first Session: a visitor is signed in as soon as they sign up.
     * Every sign-up from `ip` counts, the ones that fail too. Past the limit it fails with `TooManyAttempts`,
     * before the password is hashed.
     */
    signUp(
      email: Email,
      password: Password,
      ip: ClientIp,
    ): Effect.Effect<
      { readonly user: User; readonly session: OpenedSession },
      EmailAlreadyTaken | TooManyAttempts
    >;
    /**
     * Opens a new Session for the User of this email, when the password is theirs.
     * An unknown email and a wrong password fail alike, and take as long: the answer does not say who has signed up.
     *
     * A sign-in that fails counts on the email and on `ip`. Past a limit it fails with `TooManyAttempts`,
     * before the password is hashed, and whether a User has the email or not.
     * A sign-in that succeeds sets the counter of the email back to zero.
     */
    signIn(
      email: Email,
      password: Password,
      ip: ClientIp,
    ): Effect.Effect<
      { readonly user: User; readonly session: OpenedSession },
      InvalidCredentials | TooManyAttempts
    >;
    /** Revokes the Session this token opens. Succeeds when it opens none. */
    signOut(token: Redacted.Redacted<string>): Effect.Effect<void>;
    /**
     * The User of the Session this token opens.
     * It extends a Session that is close to its expiry, and answers with its new expiry as `extendedUntil`.
     * It removes a Session that has expired.
     */
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
        digest.digestHex(Digest.sha256, new TextEncoder().encode(Redacted.value(token)));

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
        signUp: Effect.fn("Identity.signUp")(function* (email, password, ip) {
          const signUps: ReadonlyArray<AttemptCounter> = [{ _tag: "SignUpsOfIp", ip }];
          yield* limiter.check(signUps);
          // Counted before it is known to succeed: one that fails costs a hash, and tells whether a User has the email.
          yield* limiter.record(signUps);
          const user = new User({ id: yield* users.nextId, email });
          yield* users.create(user, yield* hasher.hash(password));
          return { user, session: yield* openSession(user) };
        }),
        signIn: Effect.fn("Identity.signIn")(function* (email, password, ip) {
          const failuresOfEmail: AttemptCounter = { _tag: "SignInFailuresOfEmail", email };
          const failures: ReadonlyArray<AttemptCounter> = [
            failuresOfEmail,
            { _tag: "SignInFailuresOfIp", ip },
          ];
          // Before the User is looked up and the password hashed: a refusal costs nothing, and says nothing of the email.
          yield* limiter.check(failures);

          const found = yield* users.findByEmail(email);
          if (Option.isNone(found)) {
            // The slow step of a sign-in, done for nothing: without it, a fast answer would say that no User has this email.
            yield* hasher.hash(password);
            yield* limiter.record(failures);
            return yield* new InvalidCredentials();
          }
          const { user, passwordHash } = found.value;
          if (!(yield* hasher.verify(password, passwordHash))) {
            yield* limiter.record(failures);
            return yield* new InvalidCredentials();
          }
          // The counter of the address stays: one User of their own does not clear the failures on the emails of others.
          yield* limiter.reset(failuresOfEmail);
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
