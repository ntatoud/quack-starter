import type { UserId } from "@quack/contracts/identity/user";
import type { Permission } from "@quack/contracts/permission";
import { type DateTime, Duration } from "effect";

/** Long enough for an AI Client to exchange it, short enough that a leaked one is likely spent (RFC 6749 s4.1.2). */
export const authorizationCodeLifetime = Duration.minutes(1);

export const authorizationCodeBytes = 32;

/** What a User approved, held until the AI Client exchanges the code. The code lives only in the redirect. */
export interface AuthorizationCode {
  /** SHA-256 of the code, in hex. */
  readonly codeHash: string;
  readonly userId: UserId;
  readonly aiClientId: string;
  /** What the AI Client said it was when the User approved. */
  readonly aiClientName: string;
  readonly redirectUri: string;
  readonly resource: string;
  readonly permissions: ReadonlyArray<Permission>;
  /** The S256 challenge the exchange must answer (RFC 7636). */
  readonly codeChallenge: string;
  readonly expiresAt: DateTime.Utc;
}
