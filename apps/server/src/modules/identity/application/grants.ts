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
import {
  accessTokenBytes,
  accessTokenLifetime,
  type Grant,
  grantLifetime,
  refreshTokenBytes,
} from "#/modules/identity/domain/grant.ts";
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

const invalidRefreshToken = refused(
  "invalid_grant",
  "The refresh token is unknown, replaced, or its Grant is revoked or expired.",
);

/** What the AI Client trades for tokens, once the request says it (RFC 6749 s4.1.3 and s6). */
type Secrets =
  | { readonly _tag: "Code"; readonly code: string; readonly verifier: string }
  | { readonly _tag: "RefreshToken"; readonly refreshToken: string };

const secretsOf = (params: TokenRequestParams): Effect.Effect<Secrets, TokenRequestRefused> => {
  switch (params.grant_type) {
    case undefined:
      return Effect.fail(refused("invalid_request", "grant_type is missing."));
    case "authorization_code":
      return params.code === undefined || params.code_verifier === undefined
        ? Effect.fail(refused("invalid_request", "code and code_verifier are required."))
        : Effect.succeed({ _tag: "Code", code: params.code, verifier: params.code_verifier });
    case "refresh_token":
      return params.refresh_token === undefined
        ? Effect.fail(refused("invalid_request", "refresh_token is required."))
        : Effect.succeed({ _tag: "RefreshToken", refreshToken: params.refresh_token });
    default:
      return Effect.fail(
        refused(
          "unsupported_grant_type",
          "Only authorization_code and refresh_token are supported.",
        ),
      );
  }
};

/** The Permissions in every one of `sets`, in the order of the first. */
const held = (
  first: ReadonlyArray<Permission>,
  ...others: ReadonlyArray<ReadonlyArray<Permission>>
) => first.filter((permission) => others.every((set) => set.includes(permission)));

export class Grants extends Context.Service<
  Grants,
  {
    /**
     * Exchanges an authorization code for tokens of the Grant the User approved (RFC 6749 s4.1.3), or a
     * refresh token for new ones (s6), which extends the Grant.
     */
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
      const redeem = (
        params: TokenRequestParams,
        { code, verifier }: Extract<Secrets, { _tag: "Code" }>,
      ) =>
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

      /** New tokens of the Grant, for the resource and Permissions they carry from the code. */
      const issue = Effect.fnUntraced(function* (
        grant: Grant,
        terms: { readonly resource: string; readonly permissions: ReadonlyArray<Permission> },
      ) {
        const accessToken = Base64Url.encode(yield* random.randomBytes(accessTokenBytes));
        const refreshToken = Base64Url.encode(yield* random.randomBytes(refreshTokenBytes));

        yield* grants.saveAccessToken({
          tokenHash: yield* sha256Hex(digest, accessToken),
          grantId: grant.id,
          ...terms,
          expiresAt: DateTime.addDuration(yield* DateTime.now, accessTokenLifetime),
        });

        yield* grants.saveRefreshToken({
          tokenHash: yield* sha256Hex(digest, refreshToken),
          grantId: grant.id,
          ...terms,
          replaced: false,
        });

        return {
          access_token: accessToken,
          token_type: "Bearer" as const,
          expires_in: Duration.toSeconds(accessTokenLifetime),
          scope: terms.permissions.join(" "),
          refresh_token: refreshToken,
        };
      });

      /**
       * The User of a Grant that has not expired, while they may sign in. Nothing sweeps the store: a Grant
       * that expired, or whose User is no longer `active`, leaves it when it is read, as their Session does.
       */
      const userOfLiveGrant = Effect.fnUntraced(function* (grant: Grant) {
        const user = yield* users.findById(grant.userId);

        if (
          DateTime.isGreaterThanOrEqualTo(yield* DateTime.now, grant.expiresAt) ||
          Option.isNone(user) ||
          !canSignIn(user.value)
        ) {
          yield* grants.revoke(grant.id);

          return Option.none();
        }

        return user;
      });

      return Grants.of({
        exchange: Effect.fn("Grants.exchange")(function* (params) {
          const secrets = yield* secretsOf(params);

          if (secrets._tag === "Code") {
            const code = yield* redeem(params, secrets);
            const grant = yield* grants.findOf(code.userId, code.aiClientId);

            if (Option.isNone(grant)) return yield* invalidGrant;

            return yield* issue(grant.value, {
              resource: code.resource,
              permissions: held(code.permissions, grant.value.permissions),
            });
          }

          // Replaced before anything is checked, as a code is spent: a refused refresh token is not tried again.
          const found = yield* grants.replaceRefreshToken(
            yield* sha256Hex(digest, secrets.refreshToken),
          );

          if (Option.isNone(found)) return yield* invalidRefreshToken;
          const { grant, refreshToken } = found.value;

          // Two AI Clients hold it, one a thief, and Quack cannot tell which: neither keeps the Grant.
          if (refreshToken.replaced) {
            yield* grants.revoke(grant.id);

            return yield* invalidRefreshToken;
          }

          if (
            Option.isNone(yield* userOfLiveGrant(grant)) ||
            params.client_id !== grant.aiClientId
          ) {
            return yield* invalidRefreshToken;
          }

          if (params.resource !== undefined && params.resource !== refreshToken.resource) {
            return yield* refused("invalid_target", `resource must be ${refreshToken.resource}.`);
          }

          yield* grants.extend(grant.id, DateTime.addDuration(yield* DateTime.now, grantLifetime));

          return yield* issue(grant, {
            resource: refreshToken.resource,
            permissions: held(refreshToken.permissions, grant.permissions),
          });
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
            DateTime.isGreaterThanOrEqualTo(now, accessToken.expiresAt)
          ) {
            return yield* new Unauthenticated();
          }

          const user = yield* userOfLiveGrant(grant);

          if (Option.isNone(user)) return yield* new Unauthenticated();
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
