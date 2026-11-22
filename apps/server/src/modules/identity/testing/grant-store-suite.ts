import { assert, describe, it } from "@effect/vitest";
import type { UserId } from "@quack/contracts/identity/user";
import { DateTime, Effect, type Layer, Option } from "effect";

import type {
  AccessToken,
  Grant,
  GrantDraft,
  RefreshToken,
} from "#/modules/identity/domain/grant.ts";
import { GrantStore } from "#/modules/identity/domain/grant-store.ts";

const at = (iso: string) => DateTime.makeUnsafe(iso);

// An adapter that persists keeps the Grants of the tests before, so each test has its own User and tokens.
const aTokenHash = Effect.sync(() => crypto.randomUUID());

const aDraft = (userId: UserId, fields: Partial<GrantDraft> = {}): GrantDraft => ({
  userId,
  aiClientId: "https://claude.ai/oauth/client.json",
  aiClientName: "Claude",
  redirectUri: "https://claude.ai/api/mcp/auth_callback",
  resource: "https://quack.test/api/mcp",
  permissions: ["todos:list", "todos:write"],
  expiresAt: at("2026-02-01T00:00:00Z"),
  ...fields,
});

const anAccessToken = (grant: Grant) =>
  Effect.map(aTokenHash, (tokenHash): AccessToken => ({
    tokenHash,
    grantId: grant.id,
    resource: grant.resource,
    permissions: ["todos:list"],
    expiresAt: at("2026-01-01T01:00:00Z"),
  }));

const aRefreshToken = (grant: Grant) =>
  Effect.map(aTokenHash, (tokenHash): RefreshToken => ({
    tokenHash,
    grantId: grant.id,
    resource: grant.resource,
    permissions: ["todos:list"],
    replaced: false,
  }));

const nextTokens = (grant: Grant) =>
  Effect.gen(function* () {
    return {
      accessToken: yield* anAccessToken(grant),
      refreshToken: yield* aRefreshToken(grant),
      grantExpiresAt: at("2026-03-01T00:00:00Z"),
    };
  });

/**
 * The promises of a `GrantStore`. `aUser` gives the id of a new User, which an adapter with foreign keys
 * must have stored.
 */
export const grantStoreSuite = <R>(
  layer: Layer.Layer<GrantStore | R>,
  aUser: Effect.Effect<UserId, never, R>,
) => {
  const aGrantWithARefreshToken = Effect.gen(function* () {
    const store = yield* GrantStore;
    const grant = yield* store.save(aDraft(yield* aUser));
    const refreshToken = yield* aRefreshToken(grant);
    yield* store.saveRefreshToken(refreshToken);

    return { grant, refreshToken };
  });

  const test = (name: string, body: () => Effect.Effect<void, never, GrantStore | R>) =>
    it.effect(name, () => body().pipe(Effect.provide(layer)));

  describe("GrantStore", () => {
    test("finds the Grant a User gave an AI Client, as it was saved", () =>
      Effect.gen(function* () {
        const store = yield* GrantStore;
        const draft = aDraft(yield* aUser);

        const grant = yield* store.save(draft);

        assert.deepStrictEqual(grant, { ...draft, id: grant.id });
        assert.deepStrictEqual(
          yield* store.findOf(draft.userId, draft.aiClientId),
          Option.some(grant),
        );
      }));

    test("finds no Grant of another User, or to another AI Client", () =>
      Effect.gen(function* () {
        const store = yield* GrantStore;
        const draft = aDraft(yield* aUser);
        yield* store.save(draft);

        assert.isTrue(Option.isNone(yield* store.findOf(yield* aUser, draft.aiClientId)));
        assert.isTrue(
          Option.isNone(yield* store.findOf(draft.userId, "https://other.example.com/client.json")),
        );
      }));

    test("keeps one Grant per User and AI Client: saving again replaces its terms and keeps its id", () =>
      Effect.gen(function* () {
        const store = yield* GrantStore;
        const userId = yield* aUser;
        const first = yield* store.save(aDraft(userId));

        const other = yield* store.save(
          aDraft(userId, { aiClientId: "https://other.example.com/client.json" }),
        );

        const changed = aDraft(userId, {
          aiClientName: "Claude Code",
          redirectUri: "http://localhost:51234/callback",
          permissions: ["todos:delete"],
          expiresAt: at("2026-03-01T00:00:00Z"),
        });

        const second = yield* store.save(changed);

        assert.deepStrictEqual(second, { ...changed, id: first.id });
        assert.deepStrictEqual(
          yield* store.findOf(userId, changed.aiClientId),
          Option.some(second),
        );
        assert.deepStrictEqual(yield* store.findOf(userId, other.aiClientId), Option.some(other));
      }));

    test("finds a Grant by the hash of an access token it holds, with the token", () =>
      Effect.gen(function* () {
        const store = yield* GrantStore;
        const grant = yield* store.save(aDraft(yield* aUser));

        const accessToken: AccessToken = {
          tokenHash: yield* aTokenHash,
          grantId: grant.id,
          resource: grant.resource,
          permissions: ["todos:list"],
          expiresAt: at("2000-01-01T00:00:00Z"),
        };

        yield* store.saveAccessToken(accessToken);

        assert.deepStrictEqual(
          yield* store.findByAccessToken(accessToken.tokenHash),
          Option.some({ grant, accessToken }),
        );
      }));

    test("saving a Grant again revokes its access tokens, and no other Grant's", () =>
      Effect.gen(function* () {
        const store = yield* GrantStore;
        const userId = yield* aUser;
        const grant = yield* store.save(aDraft(userId));

        const other = yield* store.save(
          aDraft(userId, { aiClientId: "https://other.example.com/client.json" }),
        );

        const tokenOf = (grantId: string) =>
          Effect.map(aTokenHash, (tokenHash): AccessToken => ({
            tokenHash,
            grantId,
            resource: grant.resource,
            permissions: ["todos:list"],
            expiresAt: at("2026-01-01T01:00:00Z"),
          }));

        const revoked = [yield* tokenOf(grant.id), yield* tokenOf(grant.id)];
        const kept = yield* tokenOf(other.id);

        for (const token of [...revoked, kept]) yield* store.saveAccessToken(token);
        yield* store.save(aDraft(userId, { permissions: ["todos:list"] }));

        for (const token of revoked) {
          assert.isTrue(Option.isNone(yield* store.findByAccessToken(token.tokenHash)));
        }

        assert.deepStrictEqual(
          yield* store.findByAccessToken(kept.tokenHash),
          Option.some({ grant: other, accessToken: kept }),
        );
      }));

    test("finds nothing for an unknown token hash", () =>
      Effect.gen(function* () {
        const store = yield* GrantStore;

        assert.isTrue(Option.isNone(yield* store.findByAccessToken(yield* aTokenHash)));
      }));

    test("finds a Grant by the hash of a refresh token it holds, with the token", () =>
      Effect.gen(function* () {
        const store = yield* GrantStore;
        const { grant, refreshToken } = yield* aGrantWithARefreshToken;

        assert.deepStrictEqual(
          yield* store.findByRefreshToken(refreshToken.tokenHash),
          Option.some({ grant, refreshToken }),
        );
      }));

    test("finds nothing for an unknown refresh token hash", () =>
      Effect.gen(function* () {
        const store = yield* GrantStore;

        assert.isTrue(Option.isNone(yield* store.findByRefreshToken(yield* aTokenHash)));
      }));

    test("rotating a refresh token replaces it with the next tokens, and extends its Grant", () =>
      Effect.gen(function* () {
        const store = yield* GrantStore;
        const { grant, refreshToken } = yield* aGrantWithARefreshToken;
        const next = yield* nextTokens(grant);

        assert.isTrue(yield* store.rotateRefreshToken(refreshToken.tokenHash, next));

        const extended = { ...grant, expiresAt: next.grantExpiresAt };
        assert.deepStrictEqual(
          yield* store.findByRefreshToken(refreshToken.tokenHash),
          Option.some({ grant: extended, refreshToken: { ...refreshToken, replaced: true } }),
        );
        assert.deepStrictEqual(
          yield* store.findByRefreshToken(next.refreshToken.tokenHash),
          Option.some({ grant: extended, refreshToken: next.refreshToken }),
        );
        assert.deepStrictEqual(
          yield* store.findByAccessToken(next.accessToken.tokenHash),
          Option.some({ grant: extended, accessToken: next.accessToken }),
        );
      }));

    test("rotates a refresh token once: the next tokens of a second rotation are not saved", () =>
      Effect.gen(function* () {
        const store = yield* GrantStore;
        const { grant, refreshToken } = yield* aGrantWithARefreshToken;
        yield* store.rotateRefreshToken(refreshToken.tokenHash, yield* nextTokens(grant));
        const second = yield* nextTokens(grant);

        assert.isFalse(yield* store.rotateRefreshToken(refreshToken.tokenHash, second));
        assert.isTrue(
          Option.isNone(yield* store.findByRefreshToken(second.refreshToken.tokenHash)),
        );
        assert.isTrue(Option.isNone(yield* store.findByAccessToken(second.accessToken.tokenHash)));
      }));

    test("of two callers that rotate the same refresh token at once, one only rotates it", () =>
      Effect.gen(function* () {
        const store = yield* GrantStore;
        const { grant, refreshToken } = yield* aGrantWithARefreshToken;

        const rotated = yield* Effect.all(
          [
            store.rotateRefreshToken(refreshToken.tokenHash, yield* nextTokens(grant)),
            store.rotateRefreshToken(refreshToken.tokenHash, yield* nextTokens(grant)),
          ],
          { concurrency: 2 },
        );

        assert.deepStrictEqual(rotated.toSorted(), [false, true]);
      }));

    test("rotates no refresh token of a revoked Grant", () =>
      Effect.gen(function* () {
        const store = yield* GrantStore;
        const { grant, refreshToken } = yield* aGrantWithARefreshToken;
        const next = yield* nextTokens(grant);
        yield* store.revoke(grant.id);

        assert.isFalse(yield* store.rotateRefreshToken(refreshToken.tokenHash, next));
        assert.isTrue(Option.isNone(yield* store.findByAccessToken(next.accessToken.tokenHash)));
      }));

    test("revoking a Grant removes it with its tokens, and leaves the other Grants be", () =>
      Effect.gen(function* () {
        const store = yield* GrantStore;
        const userId = yield* aUser;
        const grant = yield* store.save(aDraft(userId));

        const other = yield* store.save(
          aDraft(userId, { aiClientId: "https://other.example.com/client.json" }),
        );

        const [accessToken, refreshToken] = [
          yield* anAccessToken(grant),
          yield* aRefreshToken(grant),
        ];

        const otherAccessToken = yield* anAccessToken(other);
        yield* store.saveAccessToken(accessToken);
        yield* store.saveRefreshToken(refreshToken);
        yield* store.saveAccessToken(otherAccessToken);

        yield* store.revoke(grant.id);

        assert.isTrue(Option.isNone(yield* store.findOf(userId, grant.aiClientId)));
        assert.isTrue(Option.isNone(yield* store.findByAccessToken(accessToken.tokenHash)));
        assert.isTrue(Option.isNone(yield* store.findByRefreshToken(refreshToken.tokenHash)));
        assert.isTrue(Option.isSome(yield* store.findByAccessToken(otherAccessToken.tokenHash)));
      }));
  });
};
