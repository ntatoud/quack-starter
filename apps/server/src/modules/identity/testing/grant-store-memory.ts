import { DateTime, Effect, Layer, Option, Order } from "effect";

import type { AccessToken, Grant, RefreshToken } from "#/modules/identity/domain/grant.ts";
import { GrantStore } from "#/modules/identity/domain/grant-store.ts";

// As the Postgres adapter: last used first, never used last, then by id.
const byLastUse = Order.combine(
  Order.mapInput(Order.flip(Option.makeOrder(DateTime.Order)), (grant: Grant) =>
    Option.fromNullishOr(grant.lastUsedAt),
  ),
  Order.mapInput(Order.String, (grant: Grant) => grant.id),
);

export const GrantStoreMemory = Layer.sync(GrantStore, () => {
  const grants = new Map<string, Grant>();
  const accessTokens = new Map<string, AccessToken>();
  const refreshTokens = new Map<string, RefreshToken>();
  const keyOf = (userId: string, aiClientId: string) => JSON.stringify([userId, aiClientId]);

  const byId = (id: string) =>
    Option.fromNullishOr([...grants.values()].find((grant) => grant.id === id));

  const revoke = (grantId: string) => {
    for (const { userId, aiClientId } of Option.toArray(byId(grantId))) {
      grants.delete(keyOf(userId, aiClientId));
    }

    for (const tokens of [accessTokens, refreshTokens]) {
      for (const [hash, token] of tokens) if (token.grantId === grantId) tokens.delete(hash);
    }
  };

  return GrantStore.of({
    save: (draft) =>
      Effect.sync(() => {
        const key = keyOf(draft.userId, draft.aiClientId);
        const saved = grants.get(key);

        const grant = {
          ...draft,
          id: saved?.id ?? crypto.randomUUID(),
          lastUsedAt: saved?.lastUsedAt ?? null,
        };

        grants.set(key, grant);

        for (const tokens of [accessTokens, refreshTokens]) {
          for (const [tokenHash, token] of tokens) {
            if (token.grantId === grant.id) tokens.delete(tokenHash);
          }
        }

        return grant;
      }),
    findOf: (userId, aiClientId) =>
      Effect.sync(() => Option.fromNullishOr(grants.get(keyOf(userId, aiClientId)))),
    listOf: (userId) =>
      Effect.sync(() =>
        [...grants.values()].filter((grant) => grant.userId === userId).toSorted(byLastUse),
      ),
    markUsed: (grantId, at) =>
      Effect.sync(() => {
        for (const grant of Option.toArray(byId(grantId))) {
          grants.set(keyOf(grant.userId, grant.aiClientId), { ...grant, lastUsedAt: at });
        }
      }),
    changePermissionsOf: (userId, grantId, permissions) =>
      Effect.sync(() =>
        Option.map(
          Option.filter(byId(grantId), (grant) => grant.userId === userId),
          (grant) => {
            const changed = { ...grant, permissions };

            grants.set(keyOf(grant.userId, grant.aiClientId), changed);

            for (const [tokenHash, token] of accessTokens) {
              if (token.grantId === grantId) accessTokens.set(tokenHash, { ...token, permissions });
            }

            for (const [tokenHash, token] of refreshTokens) {
              if (token.grantId === grantId)
                refreshTokens.set(tokenHash, { ...token, permissions });
            }

            return changed;
          },
        ),
      ),
    saveAccessToken: (token) => Effect.sync(() => void accessTokens.set(token.tokenHash, token)),
    findByAccessToken: (tokenHash) =>
      Effect.sync(() =>
        Option.flatMap(Option.fromNullishOr(accessTokens.get(tokenHash)), (accessToken) =>
          Option.map(byId(accessToken.grantId), (grant) => ({ grant, accessToken })),
        ),
      ),
    saveRefreshToken: (token) => Effect.sync(() => void refreshTokens.set(token.tokenHash, token)),
    findByRefreshToken: (tokenHash) =>
      Effect.sync(() =>
        Option.flatMap(Option.fromNullishOr(refreshTokens.get(tokenHash)), (refreshToken) =>
          Option.map(byId(refreshToken.grantId), (grant) => ({ grant, refreshToken })),
        ),
      ),
    rotateRefreshToken: (tokenHash, next) =>
      Effect.sync(() => {
        const refreshToken = refreshTokens.get(tokenHash);
        const grant = byId(next.refreshToken.grantId);

        if (
          refreshToken === undefined ||
          refreshToken.replaced ||
          refreshToken.grantId !== next.refreshToken.grantId ||
          Option.isNone(grant)
        ) {
          return false;
        }

        refreshTokens.set(tokenHash, { ...refreshToken, replaced: true });
        refreshTokens.set(next.refreshToken.tokenHash, next.refreshToken);
        accessTokens.set(next.accessToken.tokenHash, next.accessToken);
        const { userId, aiClientId } = grant.value;
        grants.set(keyOf(userId, aiClientId), { ...grant.value, expiresAt: next.grantExpiresAt });

        return true;
      }),
    revoke: (grantId) => Effect.sync(() => revoke(grantId)),
    revokeOf: (userId, grantId) =>
      Effect.sync(() => {
        if (!Option.exists(byId(grantId), (grant) => grant.userId === userId)) return false;

        revoke(grantId);

        return true;
      }),
  });
});
