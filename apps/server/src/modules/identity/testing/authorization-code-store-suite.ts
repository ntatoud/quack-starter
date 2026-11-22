import { assert, describe, it } from "@effect/vitest";
import { UserId } from "@quack/contracts/identity/user";
import { DateTime, Effect, type Layer, Option } from "effect";

import type { AuthorizationCode } from "#/modules/identity/domain/authorization-code.ts";
import { AuthorizationCodeStore } from "#/modules/identity/domain/authorization-code-store.ts";

// An adapter that persists keeps the codes of the tests before, so each test has its own.
const aCodeHash = Effect.sync(() => crypto.randomUUID());

const aSavedCode = (fields: Partial<AuthorizationCode> = {}) =>
  Effect.gen(function* () {
    const code = {
      codeHash: yield* aCodeHash,
      userId: UserId.make(crypto.randomUUID()),
      aiClientId: "https://claude.ai/oauth/client.json",
      aiClientName: "Claude",
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      resource: "https://quack.test/api/mcp",
      permissions: ["todos:list", "todos:delete"],
      codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      expiresAt: DateTime.makeUnsafe("2026-02-01T00:00:00Z"),
      ...fields,
    } satisfies AuthorizationCode;
    yield* (yield* AuthorizationCodeStore).save(code);
    return code;
  });

export const authorizationCodeStoreSuite = (layer: Layer.Layer<AuthorizationCodeStore>) => {
  const test = (name: string, body: () => Effect.Effect<void, never, AuthorizationCodeStore>) =>
    it.effect(name, () => body().pipe(Effect.provide(layer)));

  describe("AuthorizationCodeStore", () => {
    test("gives back a saved code once, as it was saved", () =>
      Effect.gen(function* () {
        const store = yield* AuthorizationCodeStore;
        const code = yield* aSavedCode();

        assert.deepStrictEqual(yield* store.take(code.codeHash), Option.some(code));
        assert.isTrue(Option.isNone(yield* store.take(code.codeHash)));
      }));

    test("gives back an expired code: the store does not judge expiry", () =>
      Effect.gen(function* () {
        const store = yield* AuthorizationCodeStore;
        const code = yield* aSavedCode({ expiresAt: DateTime.makeUnsafe("2000-01-01T00:00:00Z") });

        assert.deepStrictEqual(yield* store.take(code.codeHash), Option.some(code));
      }));

    test("finds nothing for an unknown code hash", () =>
      Effect.gen(function* () {
        const store = yield* AuthorizationCodeStore;

        assert.isTrue(Option.isNone(yield* store.take(yield* aCodeHash)));
      }));

    test("taking one code leaves the others of the User", () =>
      Effect.gen(function* () {
        const store = yield* AuthorizationCodeStore;
        const taken = yield* aSavedCode();
        const kept = yield* aSavedCode({ userId: taken.userId, permissions: ["todos:write"] });

        yield* store.take(taken.codeHash);

        assert.deepStrictEqual(yield* store.take(kept.codeHash), Option.some(kept));
      }));
  });
};
