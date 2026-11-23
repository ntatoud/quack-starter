import { Mailer } from "#/modules/mail/domain/mailer.ts";
import { MailerSmtp } from "#/modules/mail/infrastructure/mailer-smtp.ts";

export { Mailer };

export const MailSmtp = MailerSmtp;
