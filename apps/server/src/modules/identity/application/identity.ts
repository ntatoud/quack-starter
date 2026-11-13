import { type EmailAlreadyTaken, Unauthenticated } from "@quack/contracts/identity/identity-errors";
import { type Email, type Password, User } from "@quack/contracts/identity/user";
import { Context, DateTime, Effect, Layer, Option, Redacted } from "effect";
import { Digest, SecureRandom } from "effect/crypto";
import { Base64Url } from "effect/encoding";

import { PasswordHasher } from "#/modules/identity/domain/password-hasher.ts";
import {
  isExpired,
  type Session,
  sessionLifetime,
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
    /** Creates the User and opens their first Session: a visitor is signed in as soon as they sign up. */
    signUp(
      email: Email,
      password: Password,
    ): Effect.Effect<{ readonly user: User; readonly session: OpenedSession }, EmailAlreadyTaken>;
    /** The User of the Session this token opens. */
    authenticate(token: Redacted.Redacted<string>): Effect.Effect<User, Unauthenticated>;
  }
>()("@quack/server/identity/Identity") {
  static readonly layer = Layer.effect(
    Identity,
    Effect.gen(function* () {
      const users = yield* UserRepository;
      const sessions = yield* SessionStore;
      const hasher = yield* PasswordHasher;
      const random = yield* SecureRandom.SecureRandom;
      const digest = yield* Digest.Digest;

      const hashToken = (token: Redacted.Redacted<string>) =>
        digest.digestHex(Digest.sha256, new TextEncoder().encode(Redacted.value(token)));

      const openSession = Effect.fn("Identity.openSession")(function* (user: User) {
        const token = Redacted.make(Base64Url.encode(yield* random.randomBytes(sessionTokenBytes)));
        const session: Session = {
          tokenHash: yield* hashToken(token),
          userId: user.id,
          expiresAt: DateTime.addDuration(yield* DateTime.now, sessionLifetime),
        };
        yield* sessions.save(session);
        return { token, expiresAt: session.expiresAt } satisfies OpenedSession;
      });

      return Identity.of({
        signUp: Effect.fn("Identity.signUp")(function* (email, password) {
          const user = new User({ id: yield* users.nextId, email });
          yield* users.create(user, yield* hasher.hash(password));
          return { user, session: yield* openSession(user) };
        }),
        authenticate: Effect.fn("Identity.authenticate")(function* (token) {
          const session = yield* sessions.findByTokenHash(yield* hashToken(token));
          if (Option.isNone(session) || isExpired(session.value, yield* DateTime.now)) {
            return yield* new Unauthenticated();
          }
          const user = yield* users.findById(session.value.userId);
          if (Option.isNone(user)) {
            return yield* new Unauthenticated();
          }
          return user.value;
        }),
      });
    }),
  );
}
