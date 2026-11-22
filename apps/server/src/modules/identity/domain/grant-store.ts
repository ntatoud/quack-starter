import type { UserId } from "@quack/contracts/identity/user";
import { Context, type Effect, type Option } from "effect";

import type { AccessToken, Grant, GrantDraft } from "#/modules/identity/domain/grant.ts";

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
  }
>()("@quack/server/identity/GrantStore") {}
