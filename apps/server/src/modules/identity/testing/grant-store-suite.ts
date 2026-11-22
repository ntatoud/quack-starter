import { assert, describe, it } from "@effect/vitest";
import type { UserId } from "@quack/contracts/identity/user";
import { DateTime, Effect, type Layer, Option } from "effect";

import type { AccessToken, GrantDraft } from "#/modules/identity/domain/grant.ts";
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

/**
 * The promises of a `GrantStore`. `aUser` gives the id of a new User, which an adapter with foreign keys
 * must have stored.
 */
export const grantStoreSuite = <R>(
  layer: Layer.Layer<GrantStore | R>,
  aUser: Effect.Effect<UserId, never, R>,
) => {
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

    test("finds the Grant of a token with the terms it was last saved with", () =>
      Effect.gen(function* () {
        const store = yield* GrantStore;
        const userId = yield* aUser;
        const grant = yield* store.save(aDraft(userId));

        const accessToken: AccessToken = {
          tokenHash: yield* aTokenHash,
          grantId: grant.id,
          resource: grant.resource,
          permissions: ["todos:list"],
          expiresAt: at("2026-01-01T01:00:00Z"),
        };

        yield* store.saveAccessToken(accessToken);
        const changed = yield* store.save(aDraft(userId, { permissions: ["todos:list"] }));

        assert.deepStrictEqual(
          yield* store.findByAccessToken(accessToken.tokenHash),
          Option.some({ grant: changed, accessToken }),
        );
      }));

    test("finds nothing for an unknown token hash", () =>
      Effect.gen(function* () {
        const store = yield* GrantStore;

        assert.isTrue(Option.isNone(yield* store.findByAccessToken(yield* aTokenHash)));
      }));
  });
};
