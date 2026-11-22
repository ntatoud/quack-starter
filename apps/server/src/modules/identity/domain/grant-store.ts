import type { UserId } from "@quack/contracts/identity/user";
import type { Permission } from "@quack/contracts/permission";
import { Context, type DateTime, type Effect, type Option } from "effect";

import type {
  AccessToken,
  Grant,
  GrantDraft,
  RefreshToken,
} from "#/modules/identity/domain/grant.ts";

export class GrantStore extends Context.Service<
  GrantStore,
  {
    /**
     * One Grant per User and AI Client: saving one they already gave replaces its terms, keeps its id, and
     * revokes its access and refresh tokens at once, since a token given before could hold more than the
     * new terms.
     */
    save(grant: GrantDraft): Effect.Effect<Grant>;
    findOf(userId: UserId, aiClientId: string): Effect.Effect<Option.Option<Grant>>;
    /** Expired ones too, last used first, then those never used. */
    listOf(userId: UserId): Effect.Effect<ReadonlyArray<Grant>>;
    markUsed(grantId: string, at: DateTime.Utc): Effect.Effect<void>;
    saveAccessToken(token: AccessToken): Effect.Effect<void>;
    /** Gives back an expired token or Grant as well: their reader judges expiry. */
    findByAccessToken(
      tokenHash: string,
    ): Effect.Effect<Option.Option<{ readonly grant: Grant; readonly accessToken: AccessToken }>>;
    saveRefreshToken(token: RefreshToken): Effect.Effect<void>;
    /** Gives back a replaced token as well: its reader judges reuse. */
    findByRefreshToken(
      tokenHash: string,
    ): Effect.Effect<Option.Option<{ readonly grant: Grant; readonly refreshToken: RefreshToken }>>;
    /**
     * At once: replaces the token, unless it was already, with the tokens of `next`, and extends its
     * Grant. False when the token was replaced or its Grant revoked first: of two callers that rotate the
     * same token at once, one gets false.
     */
    rotateRefreshToken(
      tokenHash: string,
      next: {
        readonly accessToken: AccessToken;
        readonly refreshToken: RefreshToken;
        readonly grantExpiresAt: DateTime.Utc;
      },
    ): Effect.Effect<boolean>;
    /**
     * At once: sets the Permissions of the Grant, and of its access and refresh tokens, to `permissions`, as the User
     * approves them in their settings. None when the User gave no Grant of this id.
     */
    changePermissionsOf(
      userId: UserId,
      grantId: string,
      permissions: ReadonlyArray<Permission>,
    ): Effect.Effect<Option.Option<Grant>>;
    revoke(grantId: string): Effect.Effect<void>;
    /** False when the User gave no Grant of this id. */
    revokeOf(userId: UserId, grantId: string): Effect.Effect<boolean>;
  }
>()("@quack/server/identity/GrantStore") {}
