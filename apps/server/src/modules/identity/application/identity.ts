import {
  EmailAlreadyTaken,
  InvalidCredentials,
  type TooManyAttempts,
  Unauthenticated,
} from "@quack/contracts/identity/identity-errors";
import {
  type Email,
  type Password,
  type TimeZone,
  type User,
  UserId,
} from "@quack/contracts/identity/user";
import type { Auth } from "@yielded/auth";
import { Context, DateTime, Effect, Layer, Option, Redacted } from "effect";
import { SecureRandom } from "effect/crypto";

import { AppAuth } from "#/modules/identity/domain/app-auth.ts";
import {
  AttemptCounter,
  AttemptLimiter,
  type ClientIp,
} from "#/modules/identity/domain/attempt-limiter.ts";
import { canSignIn, signedIn } from "#/modules/identity/domain/user.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

/**
 * Signing up, in, and out, through Yielded Auth, which holds the credentials and the Sessions. They run in a
 * request: Yielded reads the Session from it and writes the cookie on its answer.
 * @effect-expect-leaking AuthRequest
 */
export class Identity extends Context.Service<
  Identity,
  {
    signUp(
      email: Email,
      password: Password,
      timeZone: TimeZone,
      ip: ClientIp,
    ): Effect.Effect<User, EmailAlreadyTaken | TooManyAttempts, Auth.AuthRequest>;
    signIn(
      email: Email,
      password: Password,
      ip: ClientIp,
    ): Effect.Effect<User, InvalidCredentials | TooManyAttempts, Auth.AuthRequest>;
    readonly signOut: Effect.Effect<void, never, Auth.AuthRequest>;
    /** The User of the request's Session. */
    readonly authenticate: Effect.Effect<User, Unauthenticated, Auth.AuthRequest>;
  }
>()("@quack/server/identity/Identity") {
  static readonly layer = Layer.effect(
    Identity,
    Effect.gen(function* () {
      const auth = yield* AppAuth;
      const users = yield* UserRepository;
      const limiter = yield* AttemptLimiter;
      const random = yield* SecureRandom.SecureRandom;

      const openSession = Effect.fn("Identity.openSession")(function* (
        email: Email,
        password: Password,
      ) {
        const result = yield* auth
          .signIn({ email, password: Redacted.value(password) })
          .pipe(
            Effect.catch((error) =>
              error._tag === "PasswordRejected"
                ? Effect.fail(new InvalidCredentials())
                : Effect.die(error),
            ),
          );

        // Quack asks for no second factor: a password alone authenticates.
        if (result._tag !== "Authenticated") return yield* Effect.die(result);

        const user = yield* users.findById(UserId.make(result.session.subjectId));

        if (Option.isNone(user)) return yield* Effect.die("A Session opened for no User");

        const updated = signedIn(user.value, yield* DateTime.now);
        yield* users.update(updated);

        return updated;
      });

      return Identity.of({
        signUp: Effect.fn("Identity.signUp")(function* (email, password, timeZone, ip) {
          // Counted before it is known to succeed: one that fails costs a hash, and tells whether a User has the email.
          yield* limiter.take([AttemptCounter.signUpsOfIp(ip)]);
          const id = yield* users.nextId;

          yield* auth
            .register({
              requestId: yield* random.uuidV4(),
              email,
              newPassword: Redacted.value(password),
              registration: { id, timeZone: timeZone.id },
            })
            .pipe(Effect.orDie);

          // Yielded accepts a sign-up for a taken email and creates nothing, so it tells no one the email is taken.
          // Quack does tell: the User row is the proof that this sign-up created the account.
          if (Option.isNone(yield* users.findById(id))) return yield* new EmailAlreadyTaken();

          return yield* openSession(email, password).pipe(Effect.orDie);
        }),
        signIn: Effect.fn("Identity.signIn")(function* (email, password, ip) {
          const failuresOfEmail = AttemptCounter.signInFailuresOfEmail(email);
          const failuresOfIp = AttemptCounter.signInFailuresOfIp(ip);
          // Before the lookup and the hash, so a refusal costs nothing and says nothing of the email.
          // Counted as a failure up front: sign-ins arriving at once would all pass before the first one is counted.
          yield* limiter.take([failuresOfEmail, failuresOfIp]);

          // Yielded refuses a User who is not `active` like a wrong password, after checking it.
          const user = yield* openSession(email, password);

          // The address only gives this attempt back: signing into one's own account must not clear
          // the failures on the emails of others.
          yield* limiter.reset(failuresOfEmail);
          yield* limiter.giveBack(failuresOfIp);

          return user;
        }),
        signOut: auth.signOut.pipe(Effect.ignore),
        authenticate: Effect.gen(function* () {
          const session = yield* auth.getSession().pipe(Effect.orDie);

          if (session === null) return yield* new Unauthenticated();

          const user = yield* users.findById(UserId.make(session.subjectId));

          // Yielded already refuses the Session of a User who is no longer `active`.
          if (Option.isNone(user) || !canSignIn(user.value)) return yield* new Unauthenticated();

          return user.value;
        }),
      });
    }),
  );
}
