import { executor } from "@quack/effect-kysely/kysely";
import { Password } from "@yielded/auth";
import { Effect, Layer, Redacted } from "effect";
import { sql } from "kysely";

import { db } from "#/database/db.ts";

import { AppAuth } from "#/modules/identity/domain/app-auth.ts";
import { PasswordCredentials } from "#/modules/identity/domain/password-credentials.ts";

const passwordModule = AppAuth.strategies.password.persistence.moduleId;

/**
 * Writes the tables of Yielded Auth as its own rehash does: a new verifier under a new version. A new security
 * revision of the User then refuses every Session issued before. Requires `PasswordHashing`, which
 * `AppAuthPostgres` provides.
 */
export const PasswordCredentialsPostgres = Layer.effect(
  PasswordCredentials,
  Effect.gen(function* () {
    const execute = yield* executor;
    const hashing = yield* Password.PasswordHashing;

    return PasswordCredentials.of({
      replace: Effect.fn("PasswordCredentials.replace")(function* (userId, password) {
        // Normalized as the library does before it hashes (`Password.defaultPasswordPolicy`), or sign-in would
        // not find the same bytes.
        const verifier = yield* hashing.hash(
          Redacted.make(Redacted.value(password).normalize("NFC")),
        );

        const newRevision = sql<string>`gen_random_uuid()::text`;

        yield* execute(
          db
            .with("password", (query) =>
              query
                .updateTable("authPasswords")
                .set({ verifier: Redacted.value(verifier), verifierVersion: newRevision })
                .where("subjectId", "=", userId)
                .where("moduleId", "=", passwordModule)
                .returning("subjectId"),
            )
            .updateTable("users")
            .set({ securityRevision: newRevision })
            .where("id", "=", userId),
        );
      }, Effect.orDie),
    });
  }),
);
