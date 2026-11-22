import type { UserId } from "@quack/contracts/identity/user";
import type { Permission } from "@quack/contracts/permission";
import { TodosPermission } from "@quack/contracts/todos/todos-permissions";
import { type DateTime, Duration } from "effect";

import { redirectUriMatches } from "#/modules/identity/domain/redirect-uri.ts";

/** The Permissions a Grant may hold: those of the contexts exposed to AI Clients, never `users:*`. */
export const grantablePermissions = TodosPermission.literals;

/** What an AI Client asks for when nothing says what it needs: the least that lets it do anything. */
export const basicPermissions = ["todos:list"] as const;

/** What a Grant was given for: what a request must match for the User's consent to be remembered. */
export interface GrantTerms {
  readonly aiClientId: string;
  readonly resource: string;
  readonly redirectUri: string;
  readonly permissions: ReadonlyArray<Permission>;
}

/** The active Grant already holds all the request asks for: asking the User again would tell them nothing. */
export const remembersConsent = (grant: GrantTerms, request: GrantTerms) =>
  grant.aiClientId === request.aiClientId &&
  grant.resource === request.resource &&
  redirectUriMatches(grant.redirectUri, request.redirectUri) &&
  request.permissions.every((permission) => grant.permissions.includes(permission));

/** How long a Grant lasts from the last approval or refresh, as a Session lasts from its last use. */
export const grantLifetime = Duration.days(30);

/** Short, since an AI Client keeps it where Quack cannot see: a leaked one opens the Grant for an hour at most. */
export const accessTokenLifetime = Duration.hours(1);

export const accessTokenBytes = 32;

export const refreshTokenBytes = 32;

export interface GrantDraft extends GrantTerms {
  readonly userId: UserId;
  /** What the AI Client said it was when the User last approved. */
  readonly aiClientName: string;
  readonly expiresAt: DateTime.Utc;
}

export interface Grant extends GrantDraft {
  readonly id: string;
}

/** The token lives only with the AI Client: a leaked store opens no Grant. */
export interface AccessToken {
  /** SHA-256 of the token, in hex. */
  readonly tokenHash: string;
  readonly grantId: string;
  /** Its audience: the only resource that accepts it (RFC 8707). */
  readonly resource: string;
  /** Those of the code it was exchanged for: approving more later gives an earlier code no more. */
  readonly permissions: ReadonlyArray<Permission>;
  readonly expiresAt: DateTime.Utc;
}

/**
 * What an AI Client trades for a new access token while its Grant lasts, replaced on every use. A
 * replaced one is kept, so the AI Client that presents it again shows it was stolen.
 */
export interface RefreshToken {
  /** SHA-256 of the token, in hex. */
  readonly tokenHash: string;
  readonly grantId: string;
  readonly resource: string;
  /** Those of the code the Grant's first token was exchanged for, carried from one token to the next. */
  readonly permissions: ReadonlyArray<Permission>;
  readonly replaced: boolean;
}
