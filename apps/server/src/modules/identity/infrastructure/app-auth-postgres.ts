import { NodeCrypto } from "@effect/platform-node";
import { EmailDelivery, Password, Proofs, Schema as AuthSchema, Sessions } from "@yielded/auth";
import { AuthPersistence } from "@yielded/auth-persistence";
import { Effect, Layer, Redacted } from "effect";
import { SecureRandom } from "effect/crypto";
import { Base64Url } from "effect/encoding";

import { AppAuth } from "#/modules/identity/domain/app-auth.ts";

const users = AuthPersistence.table({
  name: "users",
  columns: {
    id: { name: "id", type: "text" },
    email: { name: "email", type: "text" },
    role: { name: "role", type: "text" },
    status: { name: "status", type: "text" },
    securityRevision: { name: "security_revision", type: "text" },
    timeZone: { name: "time_zone", type: "text" },
  },
  unique: [["id"], ["email"]],
});

const identifiers = AuthPersistence.table({
  name: "auth_identifiers",
  columns: {
    moduleId: { name: "module_id", type: "text", nullable: true },
    credentialId: { name: "credential_id", type: "text", nullable: true },
    namespace: { name: "namespace", type: "text" },
    value: { name: "value", type: "text" },
    subjectId: { name: "subject_id", type: "text" },
    revision: { name: "revision", type: "text" },
    verifiedAt: { name: "verified_at", type: "integer", nullable: true },
    active: { name: "active", type: "boolean" },
  },
  unique: [["namespace", "value"]],
});

const credentials = AuthPersistence.table({
  name: "auth_credentials",
  columns: {
    credentialId: { name: "credential_id", type: "text" },
    subjectId: { name: "subject_id", type: "text" },
    revision: { name: "revision", type: "text" },
    active: { name: "active", type: "boolean" },
  },
  unique: [["credentialId"]],
});

const passwords = AuthPersistence.table({
  name: "auth_passwords",
  columns: {
    moduleId: { name: "module_id", type: "text" },
    subjectId: { name: "subject_id", type: "text" },
    credentialId: { name: "credential_id", type: "text" },
    credentialRevision: { name: "credential_revision", type: "text" },
    verifierVersion: { name: "verifier_version", type: "text" },
    verifier: { name: "verifier", type: "text" },
    normalization: { name: "normalization", type: "text" },
  },
  unique: [
    ["moduleId", "subjectId"],
    ["moduleId", "credentialId"],
  ],
});

const proofs = AuthPersistence.table({
  name: "auth_proofs",
  columns: {
    moduleId: { name: "module_id", type: "text" },
    purpose: { name: "purpose", type: "text" },
    seriesKey: { name: "series_key", type: "text" },
    proofId: { name: "proof_id", type: "text" },
    binding: { name: "binding", type: "text" },
    verifierKeyId: { name: "verifier_key_id", type: "text" },
    verifierDigest: { name: "verifier_digest", type: "text" },
    issuedAt: { name: "issued_at", type: "integer" },
    expiresAt: { name: "expires_at", type: "integer" },
    failedAttempts: { name: "failed_attempts", type: "integer" },
  },
  unique: [
    ["moduleId", "purpose", "seriesKey"],
    ["moduleId", "proofId"],
  ],
});

const sessions = AuthPersistence.table({
  name: "auth_sessions",
  columns: {
    sessionId: { name: "session_id", type: "text" },
    subjectId: { name: "subject_id", type: "text" },
    digest: { name: "digest", type: "text" },
    securityRevision: { name: "security_revision", type: "text" },
    issuedAt: { name: "issued_at", type: "integer" },
    expiresAt: { name: "expires_at", type: "integer" },
    absoluteExpiresAt: { name: "absolute_expires_at", type: "integer" },
    record: { name: "record", type: "text" },
  },
  unique: [["sessionId"], ["digest"]],
});

const pending = AuthPersistence.table({
  name: "auth_pending",
  columns: {
    moduleId: { name: "module_id", type: "text" },
    kind: { name: "kind", type: "text" },
    digest: { name: "digest", type: "text" },
    version: { name: "version", type: "text" },
    flowId: { name: "flow_id", type: "text" },
    subjectId: { name: "subject_id", type: "text" },
    bindingDigest: { name: "binding_digest", type: "text" },
    snapshot: { name: "snapshot", type: "text" },
    expiresAt: { name: "expires_at", type: "integer" },
    attemptLimit: { name: "attempt_limit", type: "integer" },
    failedAttempts: { name: "failed_attempts", type: "integer" },
    consumed: { name: "consumed", type: "boolean" },
  },
  unique: [["digest"]],
});

// A password alone signs a User in. Quack asks for no second factor.
const requirement = Sessions.AuthenticationRequirement.make({
  alternatives: [
    {
      factors: ["knowledge"],
      userVerified: false,
      phishingResistant: false,
      minimumCredentials: 1,
    },
  ],
  maximumAgeMillis: 300_000,
});

const Persistence = AuthPersistence.make(AppAuth);

const storage = Persistence.map({
  subjects: {
    table: users,
    id: "id",
    // Only an `active` User signs in, and a Session of one suspended since ends at its next request.
    status: "status",
    activeValue: "active",
    securityRevision: "securityRevision",
    idCodec: AuthSchema.SubjectId,
    requirements: () => Effect.succeed(requirement),
  },
  tables: { identifiers, credentials, passwords, proofs, sessions, pending },
});

// A sign-up creates the User row in the same commit as their credentials.
const Provisioning = Layer.succeed(Persistence.Provisioning, {
  password: {
    values: ({ identifier, registration }) =>
      Effect.sync(() => ({
        id: registration.id,
        email: identifier.value,
        role: "user",
        status: "active",
        securityRevision: crypto.randomUUID(),
        timeZone: registration.timeZone.id,
      })),
  },
});

const SessionClaims = Layer.succeed(AppAuth.strategies.password.SessionClaims, {
  resolve: () => Effect.succeed({}),
});

// Password changes and Yielded's own reset are never offered: Quack's link resets the password
// (`PasswordCredentials`). These refuse what `Password.make` with a registration requires anyway.
const UnusedPasswordManagement = Layer.mergeAll(
  Layer.succeed(Password.CompromisedPasswords, {
    check: () => Effect.succeed({ _tag: "Allowed" as const }),
  }),
  Layer.succeed(Password.PasswordActionEvidence, {
    verify: () => Effect.fail(Password.PasswordActionRequired.make({})),
  }),
  Layer.succeed(EmailDelivery.EmailDelivery, {
    send: () => Effect.fail(EmailDelivery.EmailNotAccepted.make({})),
  }),
  // A key of the process: no reset code is ever issued for it to check.
  Layer.unwrap(
    Effect.map(
      Effect.flatMap(SecureRandom.SecureRandom, (random) => random.randomBytes(32)),
      (key) =>
        Proofs.ProofKeys.layer({
          activeKeyId: "unused",
          keys: [{ id: "unused", material: Redacted.make(Base64Url.encode(key)) }],
        }),
    ),
  ),
);

const Crypto = Layer.mergeAll(NodeCrypto.layer, Password.KdfAdmission.layer());

/** Requires the `SqlClient` of the database, whose migrations create the tables above. */
export const AppAuthPostgres = AppAuth.layer.pipe(
  // Yielded's default is 15 code points; Quack's contract asks for 12 (`Password` in `identity/user.ts`).
  Layer.provide(
    Password.NewPasswordCheck.layer({ ...Password.defaultPasswordPolicy, minimumCodePoints: 12 }),
  ),
  Layer.provideMerge([SessionClaims, UnusedPasswordManagement]),
  Layer.provide(Persistence.layer.pipe(Layer.provide(Provisioning))),
  Layer.provide(Persistence.Config.layer(storage)),
  Layer.provideMerge(Password.PasswordHashing.layer()),
  Layer.provide(Crypto),
  Layer.orDie,
);
