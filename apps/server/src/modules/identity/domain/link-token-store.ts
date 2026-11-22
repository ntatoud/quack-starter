import type { UserId } from "@quack/contracts/identity/user";
import { Context, type Effect, type Option } from "effect";

import type { LinkPurpose, LinkToken } from "#/modules/identity/domain/link-token.ts";

export class LinkTokenStore extends Context.Service<
  LinkTokenStore,
  {
    save(link: LinkToken): Effect.Effect<void>;
    /**
     * Removes the link as it finds it, so a link is used once, even by two requests at once. Finds only a link of
     * `purpose`, and gives back an expired one as well: its user judges expiry.
     */
    take(tokenHash: string, purpose: LinkPurpose): Effect.Effect<Option.Option<LinkToken>>;
    removeAllOf(userId: UserId, purpose: LinkPurpose): Effect.Effect<void>;
  }
>()("@quack/server/identity/LinkTokenStore") {}
