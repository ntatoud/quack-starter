import { assert, describe, it } from "@effect/vitest";
import type { Email, UserId } from "@quack/contracts/identity/user";
import { DateTime, Effect, type Layer, Option } from "effect";

import type { LinkToken } from "#/modules/identity/domain/link-token.ts";
import { LinkTokenStore } from "#/modules/identity/domain/link-token-store.ts";

// An adapter that persists keeps the links of the tests before, so each test has its own tokens.
const aTokenHash = Effect.sync(() => crypto.randomUUID());

/**
 * `aUser` gives the id of a User the adapter may refer to: one that exists, when the storage checks it.
 */
export const linkTokenStoreSuite = <R>(
  layer: Layer.Layer<LinkTokenStore | R>,
  aUser: Effect.Effect<UserId, never, R>,
) => {
  const test = (name: string, body: () => Effect.Effect<void, never, LinkTokenStore | R>) =>
    it.effect(name, () => body().pipe(Effect.provide(layer)));

  const aSavedLink = (fields: Partial<LinkToken> = {}) =>
    Effect.gen(function* () {
      const link: LinkToken = {
        tokenHash: yield* aTokenHash,
        userId: yield* aUser,
        purpose: "password_reset",
        expiresAt: DateTime.makeUnsafe("2026-02-01T00:00:00Z"),
        newEmail: null,
        ...fields,
      };

      yield* (yield* LinkTokenStore).save(link);

      return link;
    });

  describe("LinkTokenStore", () => {
    test("takes a saved link by the hash of its token, as it was saved", () =>
      Effect.gen(function* () {
        const store = yield* LinkTokenStore;
        const link = yield* aSavedLink();

        assert.deepStrictEqual(
          yield* store.take(link.tokenHash, "password_reset"),
          Option.some(link),
        );
      }));

    test("takes a link once: a second take finds nothing", () =>
      Effect.gen(function* () {
        const store = yield* LinkTokenStore;
        const link = yield* aSavedLink();

        yield* store.take(link.tokenHash, "password_reset");

        assert.isTrue(Option.isNone(yield* store.take(link.tokenHash, "password_reset")));
      }));

    test("two takes at once find the link once", () =>
      Effect.gen(function* () {
        const store = yield* LinkTokenStore;
        const link = yield* aSavedLink();

        const taken = yield* Effect.all(
          [
            store.take(link.tokenHash, "password_reset"),
            store.take(link.tokenHash, "password_reset"),
          ],
          { concurrency: "unbounded" },
        );

        assert.lengthOf(taken.filter(Option.isSome), 1);
      }));

    test("takes an expired link as well: the store does not judge expiry", () =>
      Effect.gen(function* () {
        const store = yield* LinkTokenStore;
        const link = yield* aSavedLink({ expiresAt: DateTime.makeUnsafe("2000-01-01T00:00:00Z") });

        assert.deepStrictEqual(
          yield* store.take(link.tokenHash, "password_reset"),
          Option.some(link),
        );
      }));

    test("finds nothing for an unknown token hash", () =>
      Effect.gen(function* () {
        const store = yield* LinkTokenStore;

        assert.isTrue(Option.isNone(yield* store.take(yield* aTokenHash, "password_reset")));
      }));

    test("replaces the earlier link of the User, and leaves those of others", () =>
      Effect.gen(function* () {
        const store = yield* LinkTokenStore;
        const first = yield* aSavedLink();
        const second = yield* aSavedLink({ userId: first.userId });
        const other = yield* aSavedLink();

        assert.isTrue(Option.isNone(yield* store.take(first.tokenHash, "password_reset")));
        assert.deepStrictEqual(
          yield* store.take(second.tokenHash, "password_reset"),
          Option.some(second),
        );
        assert.deepStrictEqual(
          yield* store.take(other.tokenHash, "password_reset"),
          Option.some(other),
        );
      }));

    test("two saves at once for one User leave one link", () =>
      Effect.gen(function* () {
        const store = yield* LinkTokenStore;
        const userId = yield* aUser;

        const [first, second] = yield* Effect.all(
          [aSavedLink({ userId }), aSavedLink({ userId })],
          { concurrency: "unbounded" },
        );

        const taken = yield* Effect.all([
          store.take(first.tokenHash, "password_reset"),
          store.take(second.tokenHash, "password_reset"),
        ]);

        assert.lengthOf(taken.filter(Option.isSome), 1);
      }));
    test("keeps the new email of an Email Change link", () =>
      Effect.gen(function* () {
        const store = yield* LinkTokenStore;

        const link = yield* aSavedLink({
          purpose: "email_change",
          newEmail: "new.ada@example.com" as Email,
        });

        assert.deepStrictEqual(
          yield* store.take(link.tokenHash, "email_change"),
          Option.some(link),
        );
      }));

    test("keeps a User's links of different purposes apart", () =>
      Effect.gen(function* () {
        const store = yield* LinkTokenStore;
        const reset = yield* aSavedLink();

        const change = yield* aSavedLink({
          userId: reset.userId,
          purpose: "email_change",
          newEmail: "apart@example.com" as Email,
        });

        assert.isTrue(Option.isNone(yield* store.take(change.tokenHash, "password_reset")));
        assert.deepStrictEqual(
          yield* store.take(reset.tokenHash, "password_reset"),
          Option.some(reset),
        );
        assert.deepStrictEqual(
          yield* store.take(change.tokenHash, "email_change"),
          Option.some(change),
        );
      }));

    test("finds the User's link of a purpose, and leaves it in place", () =>
      Effect.gen(function* () {
        const store = yield* LinkTokenStore;

        const link = yield* aSavedLink({
          purpose: "email_change",
          newEmail: "found@example.com" as Email,
        });

        assert.deepStrictEqual(yield* store.findOf(link.userId, "email_change"), Option.some(link));
        assert.isTrue(Option.isNone(yield* store.findOf(link.userId, "password_reset")));
        assert.deepStrictEqual(
          yield* store.take(link.tokenHash, "email_change"),
          Option.some(link),
        );
      }));

    test("removes the User's link of a purpose only", () =>
      Effect.gen(function* () {
        const store = yield* LinkTokenStore;
        const reset = yield* aSavedLink();

        const change = yield* aSavedLink({
          userId: reset.userId,
          purpose: "email_change",
          newEmail: "removed@example.com" as Email,
        });

        const other = yield* aSavedLink({
          purpose: "email_change",
          newEmail: "other@example.com" as Email,
        });

        yield* store.removeOf(reset.userId, "email_change");

        assert.isTrue(Option.isNone(yield* store.take(change.tokenHash, "email_change")));
        assert.isTrue(Option.isSome(yield* store.take(reset.tokenHash, "password_reset")));
        assert.isTrue(Option.isSome(yield* store.take(other.tokenHash, "email_change")));
      }));
  });
};
