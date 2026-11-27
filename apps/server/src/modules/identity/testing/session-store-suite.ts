import { assert, describe, it } from "@effect/vitest";
import type { UserId } from "@quack/contracts/identity/user";
import { DateTime, Effect, type Layer, Option } from "effect";

import type { Session } from "#/modules/identity/domain/session.ts";
import { SessionStore } from "#/modules/identity/domain/session-store.ts";

const at = (iso: string) => DateTime.makeUnsafe(iso);

// An adapter that persists keeps the Sessions of the tests before, so each test has its own tokens.
const aTokenHash = Effect.sync(() => crypto.randomUUID());

/** `aUser` gives the id of a User the adapter may refer to: one that exists, when the storage checks it. */
export const sessionStoreSuite = <R>(
  layer: Layer.Layer<SessionStore | R>,
  aUser: Effect.Effect<UserId, never, R>,
) => {
  const test = (name: string, body: () => Effect.Effect<void, never, SessionStore | R>) =>
    it.effect(name, () => body().pipe(Effect.provide(layer)));

  const aSession = (fields: Partial<Session> = {}) =>
    Effect.gen(function* () {
      return {
        tokenHash: yield* aTokenHash,
        userId: yield* aUser,
        expiresAt: at("2026-02-01T00:00:00Z"),
        ...fields,
      } satisfies Session;
    });

  const aSavedSession = (fields: Partial<Session> = {}) =>
    Effect.gen(function* () {
      const session = yield* aSession(fields);
      yield* (yield* SessionStore).save(session);

      return session;
    });

  describe("SessionStore", () => {
    test("finds a saved Session by the hash of its token", () =>
      Effect.gen(function* () {
        const store = yield* SessionStore;
        const session = yield* aSavedSession();

        assert.deepStrictEqual(
          yield* store.findByTokenHash(session.tokenHash),
          Option.some(session),
        );
      }));

    test("finds nothing for an unknown token hash", () =>
      Effect.gen(function* () {
        const store = yield* SessionStore;

        assert.isTrue(Option.isNone(yield* store.findByTokenHash(yield* aTokenHash)));
      }));

    test("finds a Session that has expired, as it was saved: the store does not judge expiry", () =>
      Effect.gen(function* () {
        const store = yield* SessionStore;
        const session = yield* aSavedSession({ expiresAt: at("2000-01-01T00:00:00Z") });

        assert.deepStrictEqual(
          yield* store.findByTokenHash(session.tokenHash),
          Option.some(session),
        );
      }));

    test("extends a Session to the new expiry, keeps its User, and leaves the others", () =>
      Effect.gen(function* () {
        const store = yield* SessionStore;
        const session = yield* aSavedSession();
        const other = yield* aSavedSession({ userId: session.userId });
        const expiresAt = at("2026-03-01T00:00:00Z");

        yield* store.extend(session.tokenHash, expiresAt);

        assert.deepStrictEqual(
          yield* store.findByTokenHash(session.tokenHash),
          Option.some({ ...session, expiresAt }),
        );
        assert.deepStrictEqual(yield* store.findByTokenHash(other.tokenHash), Option.some(other));
      }));

    test("an extension of an unknown token hash creates no Session", () =>
      Effect.gen(function* () {
        const store = yield* SessionStore;
        const tokenHash = yield* aTokenHash;

        yield* store.extend(tokenHash, at("2026-03-01T00:00:00Z"));

        assert.isTrue(Option.isNone(yield* store.findByTokenHash(tokenHash)));
      }));

    test("an extension never brings back a removed Session", () =>
      Effect.gen(function* () {
        const store = yield* SessionStore;
        const session = yield* aSavedSession();

        yield* store.remove(session.tokenHash);
        yield* store.extend(session.tokenHash, at("2026-03-01T00:00:00Z"));

        assert.isTrue(Option.isNone(yield* store.findByTokenHash(session.tokenHash)));
      }));

    test("removes a Session and leaves the others", () =>
      Effect.gen(function* () {
        const store = yield* SessionStore;
        const removed = yield* aSavedSession();
        const kept = yield* aSavedSession({ userId: removed.userId });

        yield* store.remove(removed.tokenHash);

        assert.isTrue(Option.isNone(yield* store.findByTokenHash(removed.tokenHash)));
        assert.deepStrictEqual(yield* store.findByTokenHash(kept.tokenHash), Option.some(kept));
      }));

    test("removes every Session of a User, and leaves those of others", () =>
      Effect.gen(function* () {
        const store = yield* SessionStore;
        const first = yield* aSavedSession();
        const second = yield* aSavedSession({ userId: first.userId });
        const other = yield* aSavedSession();

        yield* store.removeAllOf(first.userId);

        assert.isTrue(Option.isNone(yield* store.findByTokenHash(first.tokenHash)));
        assert.isTrue(Option.isNone(yield* store.findByTokenHash(second.tokenHash)));
        assert.deepStrictEqual(yield* store.findByTokenHash(other.tokenHash), Option.some(other));
      }));

    test("removal is idempotent", () =>
      Effect.gen(function* () {
        const store = yield* SessionStore;
        const session = yield* aSavedSession();

        yield* store.remove(session.tokenHash);
        yield* store.remove(session.tokenHash);
        yield* store.remove(yield* aTokenHash);

        assert.isTrue(Option.isNone(yield* store.findByTokenHash(session.tokenHash)));
      }));
  });
};
