import { Effect, Layer, Option } from "effect";

import type { LinkToken } from "#/modules/identity/domain/link-token.ts";
import { LinkTokenStore } from "#/modules/identity/domain/link-token-store.ts";

export const LinkTokenStoreMemory = Layer.sync(LinkTokenStore, () => {
  const links = new Map<string, LinkToken>();

  return LinkTokenStore.of({
    save: (link) =>
      Effect.sync(() => {
        for (const [tokenHash, saved] of links) {
          if (saved.userId === link.userId && saved.purpose === link.purpose)
            links.delete(tokenHash);
        }

        links.set(link.tokenHash, link);
      }),
    take: (tokenHash, purpose) =>
      Effect.sync(() => {
        const link = links.get(tokenHash);

        if (link === undefined || link.purpose !== purpose) return Option.none();
        links.delete(tokenHash);

        return Option.some(link);
      }),
  });
});
