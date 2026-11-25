import { executor, postgres } from "@quack/effect-kysely/kysely";
import { Effect } from "effect";

const { schema } = postgres();

// The tables of Yielded Auth, mapped in `modules/identity/infrastructure/app-auth-postgres.ts`: their names are
// Quack's, their columns what the library reads. Its subject is the User: `subject_id` holds their id, as text.
// Instants are milliseconds since the epoch.
export default Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(
    schema
      .createTable("auth_identifiers")
      .addColumn("module_id", "text")
      .addColumn("credential_id", "text")
      .addColumn("namespace", "text", (column) => column.notNull())
      .addColumn("value", "text", (column) => column.notNull())
      .addColumn("subject_id", "text", (column) => column.notNull())
      .addColumn("revision", "text", (column) => column.notNull())
      .addColumn("verified_at", "bigint")
      .addColumn("active", "boolean", (column) => column.notNull())
      .addUniqueConstraint("auth_identifiers_namespace_value_key", ["namespace", "value"]),
  );
  yield* execute(
    schema
      .createIndex("auth_identifiers_subject_id_idx")
      .on("auth_identifiers")
      .column("subject_id"),
  );
  yield* execute(
    schema
      .createTable("auth_credentials")
      .addColumn("credential_id", "text", (column) => column.notNull())
      .addColumn("subject_id", "text", (column) => column.notNull())
      .addColumn("revision", "text", (column) => column.notNull())
      .addColumn("active", "boolean", (column) => column.notNull())
      .addUniqueConstraint("auth_credentials_credential_id_key", ["credential_id"]),
  );
  yield* execute(
    schema
      .createIndex("auth_credentials_subject_id_idx")
      .on("auth_credentials")
      .column("subject_id"),
  );
  yield* execute(
    schema
      .createTable("auth_passwords")
      .addColumn("module_id", "text", (column) => column.notNull())
      .addColumn("subject_id", "text", (column) => column.notNull())
      .addColumn("credential_id", "text", (column) => column.notNull())
      .addColumn("credential_revision", "text", (column) => column.notNull())
      .addColumn("verifier_version", "text", (column) => column.notNull())
      .addColumn("verifier", "text", (column) => column.notNull())
      .addColumn("normalization", "text", (column) => column.notNull())
      .addUniqueConstraint("auth_passwords_module_id_subject_id_key", ["module_id", "subject_id"])
      .addUniqueConstraint("auth_passwords_module_id_credential_id_key", [
        "module_id",
        "credential_id",
      ]),
  );
  yield* execute(
    schema
      .createTable("auth_proofs")
      .addColumn("module_id", "text", (column) => column.notNull())
      .addColumn("purpose", "text", (column) => column.notNull())
      .addColumn("series_key", "text", (column) => column.notNull())
      .addColumn("proof_id", "text", (column) => column.notNull())
      .addColumn("binding", "text", (column) => column.notNull())
      .addColumn("verifier_key_id", "text", (column) => column.notNull())
      .addColumn("verifier_digest", "text", (column) => column.notNull())
      .addColumn("issued_at", "bigint", (column) => column.notNull())
      .addColumn("expires_at", "bigint", (column) => column.notNull())
      .addColumn("failed_attempts", "bigint", (column) => column.notNull())
      .addUniqueConstraint("auth_proofs_series_key", ["module_id", "purpose", "series_key"])
      .addUniqueConstraint("auth_proofs_proof_id_key", ["module_id", "proof_id"]),
  );
  yield* execute(
    schema
      .createTable("auth_sessions")
      .addColumn("session_id", "text", (column) => column.notNull())
      .addColumn("subject_id", "text", (column) => column.notNull())
      .addColumn("digest", "text", (column) => column.notNull())
      .addColumn("security_revision", "text", (column) => column.notNull())
      .addColumn("issued_at", "bigint", (column) => column.notNull())
      .addColumn("expires_at", "bigint", (column) => column.notNull())
      .addColumn("absolute_expires_at", "bigint", (column) => column.notNull())
      .addColumn("record", "text", (column) => column.notNull())
      .addUniqueConstraint("auth_sessions_session_id_key", ["session_id"])
      .addUniqueConstraint("auth_sessions_digest_key", ["digest"]),
  );
  yield* execute(
    schema.createIndex("auth_sessions_subject_id_idx").on("auth_sessions").column("subject_id"),
  );
  yield* execute(
    schema
      .createTable("auth_pending")
      .addColumn("module_id", "text", (column) => column.notNull())
      .addColumn("kind", "text", (column) => column.notNull())
      .addColumn("digest", "text", (column) => column.notNull())
      .addColumn("version", "text", (column) => column.notNull())
      .addColumn("flow_id", "text", (column) => column.notNull())
      .addColumn("subject_id", "text", (column) => column.notNull())
      .addColumn("binding_digest", "text", (column) => column.notNull())
      .addColumn("snapshot", "text", (column) => column.notNull())
      .addColumn("expires_at", "bigint", (column) => column.notNull())
      .addColumn("attempt_limit", "bigint", (column) => column.notNull())
      .addColumn("failed_attempts", "bigint", (column) => column.notNull())
      .addColumn("consumed", "boolean", (column) => column.notNull())
      .addUniqueConstraint("auth_pending_digest_key", ["digest"]),
  );
});

export const down = Effect.gen(function* () {
  const execute = yield* executor;

  for (const table of [
    "auth_pending",
    "auth_sessions",
    "auth_proofs",
    "auth_passwords",
    "auth_credentials",
    "auth_identifiers",
  ]) {
    yield* execute(schema.dropTable(table));
  }
});
