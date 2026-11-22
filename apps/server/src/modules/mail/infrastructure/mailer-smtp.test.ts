import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Logger, Queue } from "effect";

import { Mailer } from "#/modules/mail/domain/mailer.ts";
import { MailerSmtp } from "#/modules/mail/infrastructure/mailer-smtp.ts";

// Port 1 is reserved and nothing listens on it: the connection is refused at once.
const unreachableSmtp = ConfigProvider.layer(
  ConfigProvider.fromUnknown({
    SMTP_URL: "smtp://127.0.0.1:1",
    MAIL_FROM: "Quack <no-reply@quack.dev>",
  }),
);

describe("MailerSmtp", () => {
  it.effect("logs a mail it could not send, and does not fail the caller", () =>
    Effect.gen(function* () {
      const logged = yield* Queue.unbounded<Logger.Options<unknown>>();
      const capture = Logger.make((options) => Queue.offerUnsafe(logged, options));

      yield* Effect.gen(function* () {
        const mailer = yield* Mailer;

        const sent = yield* mailer
          .send({
            to: "ada@quack.dev",
            subject: "Welcome",
            text: "Hello Ada",
            html: "<p>Hello Ada</p>",
          })
          .pipe(Effect.exit);

        assert.strictEqual(sent._tag, "Success");
        const log = yield* Queue.take(logged);
        assert.strictEqual(log.logLevel, "Error");
      }).pipe(
        Effect.provide(
          Layer.merge(MailerSmtp.pipe(Layer.provide(unreachableSmtp)), Logger.layer([capture])),
        ),
      );
    }),
  );
});
