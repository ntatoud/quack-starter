import type { UserId } from "@quack/contracts/identity/user";
import { Context, type Effect, type Option } from "effect";

import type { AccessToken, Grant, GrantDraft } from "#/modules/identity/domain/grant.ts";

export class GrantStore extends Context.Service<
  GrantStore,
  {
    /** Gives the User's Grant to the AI Client the new terms, keeping its id, or creates it if they gave none. */
    save(grant: GrantDraft): Effect.Effect<Grant>;
    findOf(userId: UserId, aiClientId: string): Effect.Effect<Option.Option<Grant>>;
    saveAccessToken(token: AccessToken): Effect.Effect<void>;
    /** Gives back an expired token or Grant as well: their reader judges expiry. */
    findByAccessToken(
      tokenHash: string,
    ): Effect.Effect<Option.Option<{ readonly grant: Grant; readonly accessToken: AccessToken }>>;
  }
>()("@quack/server/identity/GrantStore") {}
