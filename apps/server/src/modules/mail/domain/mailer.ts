import { Context, type Effect } from "effect";

export interface Mail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export class Mailer extends Context.Service<
  Mailer,
  {
    /**
     * Returns before the mail goes out, and never fails: a mail that could not be sent is logged and lost,
     * so the person asks for it again.
     */
    send(mail: Mail): Effect.Effect<void>;
  }
>()("@quack/server/mail/Mailer") {}
