import { Effect, Layer, Option } from "effect";

import type { LinkToken } from "#/modules/identity/domain/link-token.ts";
import { LinkTokenStore } from "#/modules/identity/domain/link-token-store.ts";

export const LinkTokenStoreMemory = Layer.sync(LinkTokenStore, () => {
  const links = new Map<string, LinkToken>();

  return LinkTokenStore.of({
    save: (link) => Effect.sync(() => void links.set(link.tokenHash, link)),
    take: (tokenHash, purpose) =>
      Effect.sync(() => {
        const link = links.get(tokenHash);

        if (link === undefined || link.purpose !== purpose) return Option.none();
        links.delete(tokenHash);

        return Option.some(link);
      }),
    removeAllOf: (userId, purpose) =>
      Effect.sync(() => {
        for (const [tokenHash, link] of links) {
          if (link.userId === userId && link.purpose === purpose) links.delete(tokenHash);
        }
      }),
  });
});
