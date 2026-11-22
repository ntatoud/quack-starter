import type { UserId } from "@quack/contracts/identity/user";
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
    /** One Grant per User and AI Client: saving one they already gave replaces its terms and keeps its id. */
    save(grant: GrantDraft): Effect.Effect<Grant>;
    findOf(userId: UserId, aiClientId: string): Effect.Effect<Option.Option<Grant>>;
    saveAccessToken(token: AccessToken): Effect.Effect<void>;
    /** Gives back an expired token or Grant as well: their reader judges expiry. */
    findByAccessToken(
      tokenHash: string,
    ): Effect.Effect<Option.Option<{ readonly grant: Grant; readonly accessToken: AccessToken }>>;
    saveRefreshToken(token: RefreshToken): Effect.Effect<void>;
    /**
     * Marks the token replaced, and gives it back as it was before, with its Grant: of two callers that
     * replace the same token at once, the second finds it replaced.
     */
    replaceRefreshToken(
      tokenHash: string,
    ): Effect.Effect<Option.Option<{ readonly grant: Grant; readonly refreshToken: RefreshToken }>>;
    extend(grantId: string, expiresAt: DateTime.Utc): Effect.Effect<void>;
    /** Removes the Grant with its tokens. */
    revoke(grantId: string): Effect.Effect<void>;
  }
>()("@quack/server/identity/GrantStore") {}
