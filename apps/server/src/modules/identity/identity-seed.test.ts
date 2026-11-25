import { NodeCrypto } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { devAccounts, devPassword } from "@quack/contracts/identity/dev-accounts";
import { Email, Password } from "@quack/contracts/identity/user";
import { Auth } from "@yielded/auth";
import { ConfigProvider, Effect, Layer, Schema } from "effect";
import { TestClock } from "effect/testing";

import { PgliteDatabase } from "#/database/pglite-database.ts";
import { Identity } from "#/modules/identity/application/identity.ts";
import { localAuthRequest } from "#/modules/identity/domain/app-auth.ts";
import { IdentitySeed } from "#/modules/identity/index.ts";
import { AppAuthPostgres } from "#/modules/identity/infrastructure/app-auth-postgres.ts";
import { AttemptLimiterMemory } from "#/modules/identity/infrastructure/attempt-limiter-memory.ts";
import { UserRepositoryPostgres } from "#/modules/identity/infrastructure/user-repository-postgres.ts";

const password = Schema.decodeSync(Password)(devPassword);

const devEmails = Object.entries(devAccounts).map(
  ([role, email]) => [role, Schema.decodeSync(Email)(email)] as const,
);

// Seeded twice: the second seed finds every email taken, and changes nothing.
const SeededIdentity = Layer.mergeAll(Identity.layer, IdentitySeed, IdentitySeed).pipe(
  Layer.provide([
    UserRepositoryPostgres,
    AppAuthPostgres,
    AttemptLimiterMemory.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({})))),
    NodeCrypto.layerSecureRandom,
  ]),
  Layer.provide(PgliteDatabase),
);

// Each seed hashes the dev password once per User.
layer(SeededIdentity, { timeout: 120_000 })("IdentitySeed", (it) => {
  it.effect(
    "seeds the dev accounts, who sign in with the dev password, even when seeded twice",
    () =>
      Effect.gen(function* () {
        // Seeded on the real clock: Yielded refuses a sign-in dated before the sign-up, as at the TestClock's 0.
        yield* TestClock.setTime(Date.now());
        const identity = yield* Identity;

        for (const [role, email] of devEmails) {
          const user = yield* identity.signIn(email, password, "203.0.113.1");
          assert.strictEqual(user.role, role);
        }
      }).pipe(Effect.provideService(Auth.AuthRequest, localAuthRequest)),
  );
});
