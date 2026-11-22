import { Effect, Layer, Option } from "effect";

import type { AccessToken, Grant } from "#/modules/identity/domain/grant.ts";
import { GrantStore } from "#/modules/identity/domain/grant-store.ts";

export const GrantStoreMemory = Layer.sync(GrantStore, () => {
  const grants = new Map<string, Grant>();
  const accessTokens = new Map<string, AccessToken>();
  const keyOf = (userId: string, aiClientId: string) => JSON.stringify([userId, aiClientId]);

  const byId = (id: string) =>
    Option.fromNullishOr([...grants.values()].find((grant) => grant.id === id));

  return GrantStore.of({
    save: (draft) =>
      Effect.sync(() => {
        const key = keyOf(draft.userId, draft.aiClientId);
        const grant = { ...draft, id: grants.get(key)?.id ?? crypto.randomUUID() };
        grants.set(key, grant);

        return grant;
      }),
    findOf: (userId, aiClientId) =>
      Effect.sync(() => Option.fromNullishOr(grants.get(keyOf(userId, aiClientId)))),
    saveAccessToken: (token) => Effect.sync(() => void accessTokens.set(token.tokenHash, token)),
    findByAccessToken: (tokenHash) =>
      Effect.sync(() =>
        Option.flatMap(Option.fromNullishOr(accessTokens.get(tokenHash)), (accessToken) =>
          Option.map(byId(accessToken.grantId), (grant) => ({ grant, accessToken })),
        ),
      ),
  });
});
