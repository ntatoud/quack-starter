import { Effect, Layer, Redacted } from "effect";
import { createTransport } from "nodemailer";

import { MailConfig } from "#/config.ts";
import { Mailer } from "#/modules/mail/domain/mailer.ts";

export const MailerSmtp = Layer.effect(
  Mailer,
  Effect.gen(function* () {
    const smtpUrl = yield* MailConfig.smtpUrl;
    const from = yield* MailConfig.from;

    const transport = yield* Effect.acquireRelease(
      Effect.sync(() => createTransport(Redacted.value(smtpUrl))),
      (opened) => Effect.sync(() => opened.close()),
    );

    // The fibers live as long as the server, not the request that sent the mail.
    const scope = yield* Effect.scope;

    return Mailer.of({
      send: Effect.fn("Mailer.send")(function* (mail) {
        yield* Effect.tryPromise(() => transport.sendMail({ from, ...mail })).pipe(
          Effect.catch((error) =>
            Effect.logError("A mail could not be sent and is lost", error, {
              subject: mail.subject,
            }),
          ),
          Effect.forkIn(scope),
        );
      }),
    });
  }),
);
