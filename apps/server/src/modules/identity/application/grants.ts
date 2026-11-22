import { MCP_PATH } from "@quack/contracts/api";
import { Unauthenticated } from "@quack/contracts/identity/identity-errors";
import type { User } from "@quack/contracts/identity/user";
import { TokenRequestRefused } from "@quack/contracts/oauth/oauth-errors";
import type { TokenRequestParams, TokenResponse } from "@quack/contracts/oauth/token-request";
import type { Permission } from "@quack/contracts/permission";
import { Context, DateTime, Duration, Effect, Layer, Option, Redacted } from "effect";
import { Digest, SecureRandom } from "effect/crypto";
import { Base64Url } from "effect/encoding";

import { ServerConfig } from "#/config.ts";
import { sha256Hex } from "#/modules/identity/application/sha256-hex.ts";
import { AuthorizationCodeStore } from "#/modules/identity/domain/authorization-code-store.ts";
import { accessTokenBytes, accessTokenLifetime } from "#/modules/identity/domain/grant.ts";
import { GrantStore } from "#/modules/identity/domain/grant-store.ts";
import { rolePermissions } from "#/modules/identity/domain/role-permissions.ts";
import { canSignIn } from "#/modules/identity/domain/user.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";

const refused = (error: TokenRequestRefused["error"], error_description: string) =>
  new TokenRequestRefused({ error, error_description });

const invalidGrant = refused(
  "invalid_grant",
  "The code is unknown, spent, expired, or was not given for this request.",
);

/** What only the AI Client that asked for the code knows: the code, and the verifier of its challenge. */
interface CodeSecrets {
  readonly code: string;
  readonly verifier: string;
}

/** The secrets of an authorization code grant, once the request is one (RFC 6749 s4.1.3). */
const secretsOf = (params: TokenRequestParams): Effect.Effect<CodeSecrets, TokenRequestRefused> => {
  if (params.grant_type === undefined) {
    return Effect.fail(refused("invalid_request", "grant_type is missing."));
  }

  if (params.grant_type !== "authorization_code") {
    return Effect.fail(refused("unsupported_grant_type", "Only authorization_code is supported."));
  }

  return params.code === undefined || params.code_verifier === undefined
    ? Effect.fail(refused("invalid_request", "code and code_verifier are required."))
    : Effect.succeed({ code: params.code, verifier: params.code_verifier });
};

/** The Permissions in every one of `sets`, in the order of the first. */
const held = (
  first: ReadonlyArray<Permission>,
  ...others: ReadonlyArray<ReadonlyArray<Permission>>
) => first.filter((permission) => others.every((set) => set.includes(permission)));

export class Grants extends Context.Service<
  Grants,
  {
    /** Exchanges an authorization code for an access token of the Grant the User approved (RFC 6749 s4.1.3). */
    exchange(params: TokenRequestParams): Effect.Effect<TokenResponse, TokenRequestRefused>;
    /**
     * Who an access token acts for: the User of its active Grant, with the token's Permissions that the
     * Grant and the User's Role still give. Only a token whose audience is the MCP endpoint opens it.
     */
    authenticate(
      token: Redacted.Redacted<string>,
    ): Effect.Effect<
      { readonly user: User; readonly permissions: ReadonlySet<Permission> },
      Unauthenticated
    >;
  }
>()("@quack/server/identity/Grants") {
  static readonly layer = Layer.effect(
    Grants,
    Effect.gen(function* () {
      const codes = yield* AuthorizationCodeStore;
      const grants = yield* GrantStore;
      const users = yield* UserRepository;
      const random = yield* SecureRandom.SecureRandom;
      const digest = yield* Digest.Digest;
      const mcpResource = `${yield* ServerConfig.publicOrigin}${MCP_PATH}`;

      // RFC 7636 s4.6: the challenge is the base64url of the verifier's SHA-256.
      const challengeOf = (verifier: string) =>
        Effect.map(
          digest.digest(Digest.sha256, new TextEncoder().encode(verifier)),
          Base64Url.encode,
        );

      /** The code of the request, once it was given for this request: spent either way. */
      const redeem = (params: TokenRequestParams, { code, verifier }: CodeSecrets) =>
        Effect.gen(function* () {
          // Taken before anything is checked: a code whose exchange fails is spent, so it cannot be tried again.
          const found = yield* codes.take(yield* sha256Hex(digest, code));

          if (Option.isNone(found)) return yield* invalidGrant;
          const redeemed = found.value;

          if (
            DateTime.isGreaterThanOrEqualTo(yield* DateTime.now, redeemed.expiresAt) ||
            params.client_id !== redeemed.aiClientId ||
            params.redirect_uri !== redeemed.redirectUri ||
            (yield* challengeOf(verifier)) !== redeemed.codeChallenge
          ) {
            return yield* invalidGrant;
          }

          if (params.resource !== redeemed.resource) {
            return yield* refused("invalid_target", `resource must be ${redeemed.resource}.`);
          }

          return redeemed;
        });

      return Grants.of({
        exchange: Effect.fn("Grants.exchange")(function* (params) {
          const code = yield* redeem(params, yield* secretsOf(params));
          const grant = yield* grants.findOf(code.userId, code.aiClientId);

          if (Option.isNone(grant)) return yield* invalidGrant;
          const token = Base64Url.encode(yield* random.randomBytes(accessTokenBytes));
          const permissions = held(code.permissions, grant.value.permissions);

          yield* grants.saveAccessToken({
            tokenHash: yield* sha256Hex(digest, token),
            grantId: grant.value.id,
            resource: code.resource,
            permissions,
            expiresAt: DateTime.addDuration(yield* DateTime.now, accessTokenLifetime),
          });

          return {
            access_token: token,
            token_type: "Bearer",
            expires_in: Duration.toSeconds(accessTokenLifetime),
            scope: permissions.join(" "),
          };
        }),
        authenticate: Effect.fn("Grants.authenticate")(function* (token) {
          const now = yield* DateTime.now;

          const found = yield* grants.findByAccessToken(
            yield* sha256Hex(digest, Redacted.value(token)),
          );

          if (Option.isNone(found)) return yield* new Unauthenticated();
          const { grant, accessToken } = found.value;

          if (
            accessToken.resource !== mcpResource ||
            DateTime.isGreaterThanOrEqualTo(now, accessToken.expiresAt) ||
            DateTime.isGreaterThanOrEqualTo(now, grant.expiresAt)
          ) {
            return yield* new Unauthenticated();
          }

          const user = yield* users.findById(grant.userId);

          if (Option.isNone(user) || !canSignIn(user.value)) return yield* new Unauthenticated();
          const ofRole = [...rolePermissions(user.value.role)];

          return {
            user: user.value,
            permissions: new Set(held(accessToken.permissions, grant.permissions, ofRole)),
          };
        }),
      });
    }),
  );
}
