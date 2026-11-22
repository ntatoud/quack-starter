import type { UserId } from "@quack/contracts/identity/user";
import { type DateTime, Duration } from "effect";

import type { GrantTerms } from "#/modules/identity/domain/grant.ts";

/** Long enough for an AI Client to exchange it, short enough that a leaked one is likely spent (RFC 6749 s4.1.2). */
export const authorizationCodeLifetime = Duration.minutes(1);

export const authorizationCodeBytes = 32;

/** What a User approved, held until the AI Client exchanges the code. The code lives only in the redirect. */
export interface AuthorizationCode extends GrantTerms {
  readonly codeHash: string;
  readonly userId: UserId;
  /** What the AI Client said it was when the User approved. */
  readonly aiClientName: string;
  /** The S256 challenge the exchange must answer (RFC 7636). */
  readonly codeChallenge: string;
  readonly expiresAt: DateTime.Utc;
}
