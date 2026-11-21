import { Context, Effect, Layer } from "effect";

import { type Mail, Mailer } from "#/modules/mail/domain/mailer.ts";

export class SentMails extends Context.Service<
  SentMails,
  { readonly all: Effect.Effect<ReadonlyArray<Mail>> }
>()("@quack/server/mail/SentMails") {}

export const MailerMemory = Layer.effectContext(
  Effect.sync(() => {
    const sent: Array<Mail> = [];

    return Context.make(
      Mailer,
      Mailer.of({ send: (mail) => Effect.sync(() => void sent.push(mail)) }),
    ).pipe(Context.add(SentMails, SentMails.of({ all: Effect.sync(() => [...sent]) })));
  }),
);
