import type { UserId } from "@quack/contracts/identity/user";
import { DateTime, Duration, Schema } from "effect";

/** What a link sent by email lets its holder do, once. */
export const LinkPurpose = Schema.Literals(["password_reset"]);

export type LinkPurpose = typeof LinkPurpose.Type;

export const passwordResetLifetime = Duration.hours(1);

export const linkTokenBytes = 32;

/** The token lives only in the email: a leaked store opens no link. */
export interface LinkToken {
  /** SHA-256 of the token, in hex. */
  readonly tokenHash: string;
  readonly userId: UserId;
  readonly purpose: LinkPurpose;
  readonly expiresAt: DateTime.Utc;
}

export const isLinkExpired = (link: LinkToken, now: DateTime.Utc): boolean =>
  DateTime.isGreaterThanOrEqualTo(now, link.expiresAt);
