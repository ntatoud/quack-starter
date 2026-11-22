import type { UserId } from "@quack/contracts/identity/user";
import { Permission } from "@quack/contracts/permission";
import { grantablePermissions } from "@quack/contracts/grants/grant";
import { type DateTime, Duration, Option } from "effect";

import { redirectUriMatches } from "#/modules/identity/domain/redirect-uri.ts";

/**
 * The Permissions `names` give a Grant, once each in the order of `grantablePermissions`. None when they name nothing,
 * or something no Grant may hold.
 */
export const grantableOf = (names: Iterable<string>): Option.Option<ReadonlyArray<Permission>> => {
  const named = new Set(names);
  const grantable: ReadonlySet<string> = new Set(grantablePermissions);

  return named.size > 0 && [...named].every((name) => grantable.has(name))
    ? Option.some(grantablePermissions.filter((permission) => named.has(permission)))
    : Option.none();
};

/**
 * What an AI Client asks its User for to get `missing` too (RFC 6750 s3.1, step-up): what it `held` as well,
 * since approving sets the Grant to exactly what is approved. None when no Grant may hold `missing`.
 */
export const stepUpScope = (
  held: ReadonlySet<Permission>,
  missing: Permission,
): Option.Option<ReadonlyArray<Permission>> =>
  grantablePermissions.some((grantable) => grantable === missing)
    ? Option.some(
        Permission.literals.filter((permission) => permission === missing || held.has(permission)),
      )
    : Option.none();

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

/**
 * How precisely a Grant remembers its last use: a call within this of the last one recorded writes nothing, so an
 * AI Client calling tool after tool costs no write each time.
 */
export const lastUseResolution = Duration.minutes(1);

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
  /** When an access token of the Grant last opened `/api/mcp`, `null` until one does. */
  readonly lastUsedAt: DateTime.Utc | null;
}

/** What a token of a Grant opens, carried from the code it comes from to every token after. */
export interface TokenTerms {
  /** Its audience: the only resource that accepts it (RFC 8707). */
  readonly resource: string;
  /** Those of the code: approving more later gives an earlier code no more. */
  readonly permissions: ReadonlyArray<Permission>;
}

/** The token lives only with the AI Client: a leaked store opens no Grant. */
export interface AccessToken extends TokenTerms {
  /** SHA-256 of the token, in hex. */
  readonly tokenHash: string;
  readonly grantId: string;
  readonly expiresAt: DateTime.Utc;
}

/**
 * What an AI Client trades for a new access token while its Grant lasts, replaced on every use. A
 * replaced one is kept, so the AI Client that presents it again shows it was stolen.
 */
export interface RefreshToken extends TokenTerms {
  /** SHA-256 of the token, in hex. */
  readonly tokenHash: string;
  readonly grantId: string;
  readonly replaced: boolean;
}
