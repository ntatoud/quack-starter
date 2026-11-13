import { assert, layer } from "@effect/vitest";
import { Api } from "@quack/contracts/api";
import type { Email } from "@quack/contracts/identity/user";
import { Effect, Layer, Redacted } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";

import { IdentityModule } from "#/modules/identity/index.ts";

const password = Redacted.make("correct horse battery staple");

/** What a client that does not normalize the email sends: the text as the visitor typed it. */
const asTyped = (email: string) => email as Email;

const signUp = Effect.fn(function* (email: Email) {
  const client = yield* HttpApiTest.groups(Api, ["identity"]);
  return yield* client.identity.signUp({ payload: { email, password } });
});

layer(Layer.mergeAll(IdentityModule, HttpServer.layerServices))("IdentityApi", (it) => {
  it.effect("signs a visitor up, and answers with their public User", () =>
    Effect.gen(function* () {
      const user = yield* signUp(asTyped("ada@example.com"));

      assert.strictEqual(user.email, "ada@example.com");
      assert.isAbove(user.id.length, 0);
      assert.deepStrictEqual(Object.keys(user).toSorted(), ["email", "id"]);
    }),
  );

  it.effect("normalizes the email: trimmed and lowercased", () =>
    Effect.gen(function* () {
      const user = yield* signUp(asTyped("  Linus@Example.COM "));

      assert.strictEqual(user.email, "linus@example.com");
    }),
  );

  it.effect("fails with EmailAlreadyTaken when a User has this email", () =>
    Effect.gen(function* () {
      yield* signUp(asTyped("margaret@example.com"));

      const error = yield* signUp(asTyped("margaret@example.com")).pipe(Effect.flip);

      assert.strictEqual(error._tag, "EmailAlreadyTaken");
    }),
  );

  it.effect("fails with EmailAlreadyTaken for the same email in another case", () =>
    Effect.gen(function* () {
      yield* signUp(asTyped("barbara@example.com"));

      const error = yield* signUp(asTyped(" Barbara@EXAMPLE.com")).pipe(Effect.flip);

      assert.strictEqual(error._tag, "EmailAlreadyTaken");
    }),
  );
});
