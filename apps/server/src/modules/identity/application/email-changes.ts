import {
  EmailAlreadyTaken,
  ExpiredLink,
  type TooManyAttempts,
  WrongPassword,
} from "@quack/contracts/identity/identity-errors";
import type { Email, Password, UserId } from "@quack/contracts/identity/user";
import { Context, DateTime, Effect, Layer, Option } from "effect";
import { Digest } from "effect/crypto";

import { makeLinkMaker } from "#/modules/identity/application/link-maker.ts";
import { sha256Hex } from "#/modules/identity/application/sha256-hex.ts";
import { AttemptCounter, AttemptLimiter } from "#/modules/identity/domain/attempt-limiter.ts";
import { emailChangeLifetime, isLinkExpired } from "#/modules/identity/domain/link-token.ts";
import { LinkTokenStore } from "#/modules/identity/domain/link-token-store.ts";
import { Mailer } from "#/modules/mail/index.ts";
import { Transaction } from "#/modules/transaction/index.ts";
import { Users } from "#/modules/users/index.ts";

export class EmailChanges extends Context.Service<
  EmailChanges,
  {
    /**
     * Mails a link to `newEmail`, in place of the User's earlier one, and a notice to their current email. The
     * email stays the same until the link is opened.
     */
    request(
      userId: UserId,
      newEmail: Email,
      password: Password,
    ): Effect.Effect<void, WrongPassword | EmailAlreadyTaken | TooManyAttempts>;
    cancel(userId: UserId): Effect.Effect<void>;
    /** The email of the User's Email Change whose link still works. */
    pendingEmail(userId: UserId): Effect.Effect<Option.Option<Email>>;
    /** Makes the new email the User's. Their Sessions stay. */
    confirm(token: string): Effect.Effect<void, ExpiredLink | EmailAlreadyTaken>;
  }
>()("@quack/server/identity/EmailChanges") {
  static readonly layer = Layer.effect(
    EmailChanges,
    Effect.gen(function* () {
      const users = yield* Users;
      const links = yield* LinkTokenStore;
      const limiter = yield* AttemptLimiter;
      const mailer = yield* Mailer;
      const transaction = yield* Transaction;
      const digest = yield* Digest.Digest;
      const makeLink = yield* makeLinkMaker;

      return EmailChanges.of({
        request: Effect.fn("EmailChanges.request")(function* (userId, newEmail, password) {
          // Counted before the password is checked: it also bounds how many passwords a stolen Session can try.
          yield* limiter.take([AttemptCounter.emailChangesOfUser(userId)]);

          // The Current User: found, since their Session was.
          const user = yield* Effect.orDie(
            Effect.flatMap(users.find({ id: userId }), (found) => Effect.fromOption(found)),
          );

          if (Option.isNone(yield* users.verifyPassword(user.email, password))) {
            return yield* new WrongPassword();
          }

          // The User's own email included: there would be nothing to change.
          if (yield* users.isEmailTaken(newEmail)) return yield* new EmailAlreadyTaken();

          const { url, tokenHash } = yield* makeLink("/confirm-email");

          // Replaces the earlier link of the User: asking again makes it useless.
          yield* links.save({
            tokenHash,
            userId,
            purpose: "email_change",
            expiresAt: DateTime.addDuration(yield* DateTime.now, emailChangeLifetime),
            newEmail,
          });

          // Loaded on the first mail, not with the module: the seed and other scripts that load it
          // never send one, and run without the `.tsx` hook of `@quack/emails/register`.
          const [confirmation, notice] = yield* Effect.promise(async () => {
            const [{ emailChangeConfirmation }, { emailChangeNotice }] = await Promise.all([
              import("@quack/emails/templates/email-change-confirmation"),
              import("@quack/emails/templates/email-change-notice"),
            ]);

            return Promise.all([
              emailChangeConfirmation({ url, lifetime: emailChangeLifetime }),
              emailChangeNotice({ newEmail }),
            ]);
          });

          yield* mailer.send({ to: newEmail, ...confirmation });
          yield* mailer.send({ to: user.email, ...notice });
        }),
        cancel: Effect.fn("EmailChanges.cancel")((userId) =>
          links.removeOf(userId, "email_change"),
        ),
        pendingEmail: Effect.fn("EmailChanges.pendingEmail")(function* (userId) {
          const link = yield* links.findOf(userId, "email_change");
          const now = yield* DateTime.now;

          return link.pipe(
            Option.filter((found) => !isLinkExpired(found, now)),
            Option.flatMapNullishOr((found) => found.newEmail),
          );
        }),
        confirm: Effect.fn("EmailChanges.confirm")(function* (token) {
          const tokenHash = yield* sha256Hex(digest, token);

          // In one transaction, so the link is spent only with the email changed, or refused. A refused link stays
          // spent: it ends committed.
          const outcome = yield* transaction.run(
            Effect.gen(function* () {
              const link = yield* links.take(tokenHash, "email_change");

              if (
                Option.isNone(link) ||
                link.value.newEmail === null ||
                isLinkExpired(link.value, yield* DateTime.now)
              )
                return "expired";

              const user = yield* users.find({ id: link.value.userId });

              // A User suspended since they asked is refused as a stranger would be.
              if (Option.isNone(user)) return "expired";

              return yield* users.changeEmail(user.value.id, link.value.newEmail).pipe(
                Effect.as("changed" as const),
                Effect.catchTag("EmailAlreadyTaken", () => Effect.succeed("taken" as const)),
              );
            }),
          );

          if (outcome === "expired") return yield* new ExpiredLink();

          if (outcome === "taken") return yield* new EmailAlreadyTaken();
        }),
      });
    }),
  );
}
