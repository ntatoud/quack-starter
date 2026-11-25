import { ExpiredLink, type TooManyAttempts } from "@quack/contracts/identity/identity-errors";
import type { Email, Password } from "@quack/contracts/identity/user";
import { Context, DateTime, Effect, Layer, Option } from "effect";
import { Digest, SecureRandom } from "effect/crypto";
import { Base64Url } from "effect/encoding";

import { ServerConfig } from "#/config.ts";
import { sha256Hex } from "#/modules/identity/application/sha256-hex.ts";
import {
  AttemptCounter,
  AttemptLimiter,
  type ClientIp,
} from "#/modules/identity/domain/attempt-limiter.ts";
import {
  isLinkExpired,
  linkTokenBytes,
  passwordResetLifetime,
} from "#/modules/identity/domain/link-token.ts";
import { LinkTokenStore } from "#/modules/identity/domain/link-token-store.ts";
import { PasswordHasher } from "#/modules/identity/domain/password-hasher.ts";
import { SessionStore } from "#/modules/identity/domain/session-store.ts";
import { Transaction } from "#/modules/transaction/index.ts";
import { canSignIn } from "#/modules/identity/domain/user.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";
import { Mailer } from "#/modules/mail/index.ts";

export class PasswordResets extends Context.Service<
  PasswordResets,
  {
    /** Succeeds whether a User has the email or not: only an `active` one gets the link. */
    request(email: Email, ip: ClientIp): Effect.Effect<void, TooManyAttempts>;
    /** Sets the password and ends every Session of the User. Signs no one in. */
    confirm(token: string, password: Password): Effect.Effect<void, ExpiredLink>;
  }
>()("@quack/server/identity/PasswordResets") {
  static readonly layer = Layer.effect(
    PasswordResets,
    Effect.gen(function* () {
      const users = yield* UserRepository;
      const sessions = yield* SessionStore;
      const links = yield* LinkTokenStore;
      const hasher = yield* PasswordHasher;
      const limiter = yield* AttemptLimiter;
      const mailer = yield* Mailer;
      const transaction = yield* Transaction;
      const random = yield* SecureRandom.SecureRandom;
      const digest = yield* Digest.Digest;
      const publicOrigin = yield* ServerConfig.publicOrigin;
      // The fibers live as long as the server, not the request that asked for the link.
      const scope = yield* Effect.scope;

      const sendLink = Effect.fn("PasswordResets.sendLink")(function* (email: Email) {
        const found = yield* users.findByEmail(email);

        if (Option.isNone(found) || !canSignIn(found.value.user)) return;

        const { user } = found.value;
        const token = Base64Url.encode(yield* random.randomBytes(linkTokenBytes));

        // Replaces the earlier link of the User: asking again makes it useless.
        yield* links.save({
          tokenHash: yield* sha256Hex(digest, token),
          userId: user.id,
          purpose: "password_reset",
          expiresAt: DateTime.addDuration(yield* DateTime.now, passwordResetLifetime),
          newEmail: null,
        });

        const url = new URL("/reset-password", publicOrigin);
        url.searchParams.set("token", token);

        // Loaded on the first mail, not with the module: the seed and other scripts that load it
        // never send one, and run without the `.tsx` hook of `@quack/emails/register`.
        const mail = yield* Effect.promise(async () => {
          const { passwordReset } = await import("@quack/emails/templates/password-reset");

          return passwordReset({ url: url.href, lifetime: passwordResetLifetime });
        });

        yield* mailer.send({ to: user.email, ...mail });
      });

      return PasswordResets.of({
        request: Effect.fn("PasswordResets.request")(function* (email, ip) {
          // Counted whether a User has the email or not, so the refusal says nothing of it either.
          yield* limiter.take([
            AttemptCounter.passwordResetsOfEmail(email),
            AttemptCounter.passwordResetsOfIp(ip),
          ]);

          // In the background: the answer would otherwise take longer for a User who gets the mail, and its
          // timing would tell who has an account.
          yield* sendLink(email).pipe(
            Effect.catchCause((cause) =>
              Effect.logError("A Password Reset link could not be sent", cause),
            ),
            Effect.forkIn(scope),
          );
        }),
        confirm: Effect.fn("PasswordResets.confirm")(function* (token, password) {
          const tokenHash = yield* sha256Hex(digest, token);

          // In one transaction: a failure halfway never spends the link with the old password kept, nor
          // changes the password with the old Sessions open. A refused link stays spent: it ends committed.
          const changed = yield* transaction.run(
            Effect.gen(function* () {
              const link = yield* links.take(tokenHash, "password_reset");

              if (Option.isNone(link) || isLinkExpired(link.value, yield* DateTime.now))
                return false;

              const user = yield* users.findById(link.value.userId);

              // A User suspended since they asked is refused as a stranger would be.
              if (Option.isNone(user) || !canSignIn(user.value)) return false;

              yield* users.setPasswordHash(user.value.id, yield* hasher.hash(password));
              // Whoever knew the old password, or holds a Session opened with it, is shut out.
              yield* sessions.removeAllOf(user.value.id);

              return true;
            }),
          );

          if (!changed) return yield* new ExpiredLink();
        }),
      });
    }),
  );
}
