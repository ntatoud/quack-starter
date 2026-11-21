import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { Mailer } from "#/modules/mail/domain/mailer.ts";
import { MailerMemory, SentMails } from "#/modules/mail/testing/mailer-memory.ts";

describe("MailerMemory", () => {
  it.effect("records each mail sent, in order", () =>
    Effect.gen(function* () {
      const mailer = yield* Mailer;

      const welcome = {
        to: "ada@quack.dev",
        subject: "Welcome",
        text: "Hello Ada",
        html: "<p>Hello Ada</p>",
      };

      const reminder = {
        to: "bob@quack.dev",
        subject: "Reminder",
        text: "Hello Bob",
        html: "<p>Hello Bob</p>",
      };

      yield* mailer.send(welcome);
      yield* mailer.send(reminder);

      assert.deepStrictEqual(yield* (yield* SentMails).all, [welcome, reminder]);
    }).pipe(Effect.provide(MailerMemory)),
  );
});
