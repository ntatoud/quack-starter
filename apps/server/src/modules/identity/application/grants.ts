import { MCP_PATH } from "@quack/contracts/api";
import { GrantNotFound, PermissionNotGrantable } from "@quack/contracts/grants/grant-errors";
import { grantablePermissions } from "@quack/contracts/grants/grant";
import type { GrantId } from "@quack/contracts/grants/grant";
import { type TooManyAttempts, Unauthenticated } from "@quack/contracts/identity/identity-errors";
import type { User, UserId } from "@quack/contracts/identity/user";
import { TokenRequestRefused } from "@quack/contracts/oauth/oauth-errors";
import type { TokenRequestParams, TokenResponse } from "@quack/contracts/oauth/token-request";
import type { Permission } from "@quack/contracts/permission";
import { Context, DateTime, Duration, Effect, Exit, Layer, Option, Redacted } from "effect";
import { Digest, SecureRandom } from "effect/crypto";
import { Base64Url } from "effect/encoding";

import { ServerConfig } from "#/config.ts";
import { sha256Hex } from "#/modules/identity/application/sha256-hex.ts";
import {
  AttemptCounter,
  AttemptLimiter,
  type ClientIp,
} from "#/modules/identity/domain/attempt-limiter.ts";
import { AuthorizationCodeStore } from "#/modules/identity/domain/authorization-code-store.ts";
import {
  accessTokenBytes,
  accessTokenLifetime,
  type Grant,
  grantLifetime,
  lastUseResolution,
  refreshTokenBytes,
  type TokenTerms,
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
type TokenRequestSecrets =
  | { readonly _tag: "Code"; readonly code: string; readonly verifier: string }
  | { readonly _tag: "RefreshToken"; readonly refreshToken: string };

const secretsOf = (
  params: TokenRequestParams,
): Effect.Effect<TokenRequestSecrets, TokenRequestRefused> => {
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

// A guess at a code or a refresh token counts against the address, a malformed request does not. The token endpoint
// never answers `invalid_client`: an AI Client has no secret, and a wrong `client_id` is an `invalid_grant`.
const isCountedFailure = (exit: Exit.Exit<unknown, TokenRequestRefused>) =>
  Option.exists(Exit.findErrorOption(exit), ({ error }) => error === "invalid_grant");

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
     * refresh token for new ones (s6), which extends the Grant. Refused with `TooManyAttempts` once the
     * address `ip` has failed too many.
     */
    exchange(
      params: TokenRequestParams,
      ip: ClientIp,
    ): Effect.Effect<TokenResponse, TokenRequestRefused | TooManyAttempts>;
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
    /** The User's Grants that have not expired, last used first. */
    listOf(userId: UserId): Effect.Effect<ReadonlyArray<Grant>>;
    /**
     * Sets the Permissions of the User's active Grant, fewer or more, as the User approves them in their settings:
     * its tokens hold them from their next use, and so do those of a refresh. Only the User who gave it may.
     */
    changePermissions(
      userId: UserId,
      grantId: GrantId,
      permissions: ReadonlyArray<Permission>,
    ): Effect.Effect<Grant, GrantNotFound | PermissionNotGrantable>;
    /** Only the User who gave it may. */
    revoke(userId: UserId, grantId: GrantId): Effect.Effect<void, GrantNotFound>;
  }
>()("@quack/server/identity/Grants") {
  static readonly layer = Layer.effect(
    Grants,
    Effect.gen(function* () {
      const codes = yield* AuthorizationCodeStore;
      const grants = yield* GrantStore;
      const users = yield* UserRepository;
      const limiter = yield* AttemptLimiter;
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
        { code, verifier }: Extract<TokenRequestSecrets, { _tag: "Code" }>,
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

      /** A new token, and its hash, the only part of it Quack keeps. */
      const newToken = (bytes: number) =>
        Effect.gen(function* () {
          const token = Base64Url.encode(yield* random.randomBytes(bytes));

          return { token, tokenHash: yield* sha256Hex(digest, token) };
        });

      /** New tokens of the Grant, as Quack keeps them and as the AI Client gets them. */
      const tokensOf = Effect.fnUntraced(function* (grantId: string, terms: TokenTerms) {
        const access = yield* newToken(accessTokenBytes);
        const refresh = yield* newToken(refreshTokenBytes);
        const now = yield* DateTime.now;

        return {
          accessToken: {
            tokenHash: access.tokenHash,
            grantId,
            ...terms,
            expiresAt: DateTime.addDuration(now, accessTokenLifetime),
          },
          refreshToken: { tokenHash: refresh.tokenHash, grantId, ...terms, replaced: false },
          response: {
            access_token: access.token,
            token_type: "Bearer" as const,
            expires_in: Duration.toSeconds(accessTokenLifetime),
            scope: terms.permissions.join(" "),
            refresh_token: refresh.token,
          },
        };
      });

      /**
       * The User of a Grant that has not expired, while they may sign in; otherwise the Grant is revoked.
       * Nothing sweeps the store: a Grant that expired, or whose User is no longer `active`, leaves it when
       * it is read, as their Session does.
       */
      const revokeUnlessLive = Effect.fnUntraced(function* (grant: Grant) {
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

      const exchangeCode = Effect.fnUntraced(function* (
        params: TokenRequestParams,
        secrets: Extract<TokenRequestSecrets, { _tag: "Code" }>,
      ) {
        const code = yield* redeem(params, secrets);
        const grant = yield* grants.findOf(code.userId, code.aiClientId);

        if (Option.isNone(grant)) return yield* invalidGrant;

        const tokens = yield* tokensOf(grant.value.id, {
          resource: code.resource,
          permissions: held(code.permissions, grant.value.permissions),
        });

        yield* grants.saveAccessToken(tokens.accessToken);
        yield* grants.saveRefreshToken(tokens.refreshToken);

        return tokens.response;
      });

      // Unlike a code, a refresh token is replaced only once the request is valid: an AI Client that sent a
      // wrong parameter may try again, where a replaced token would revoke its Grant.
      const refresh = Effect.fnUntraced(function* (params: TokenRequestParams, token: string) {
        const tokenHash = yield* sha256Hex(digest, token);
        const found = yield* grants.findByRefreshToken(tokenHash);

        if (Option.isNone(found)) return yield* invalidRefreshToken;
        const { grant, refreshToken } = found.value;

        // Two AI Clients hold it, one a thief, and Quack cannot tell which: neither keeps the Grant.
        if (refreshToken.replaced) {
          yield* grants.revoke(grant.id);

          return yield* invalidRefreshToken;
        }

        if (
          Option.isNone(yield* revokeUnlessLive(grant)) ||
          params.client_id !== grant.aiClientId
        ) {
          return yield* invalidRefreshToken;
        }

        if (params.resource !== undefined && params.resource !== refreshToken.resource) {
          return yield* refused("invalid_target", `resource must be ${refreshToken.resource}.`);
        }

        const tokens = yield* tokensOf(grant.id, {
          resource: refreshToken.resource,
          permissions: held(refreshToken.permissions, grant.permissions),
        });

        const rotated = yield* grants.rotateRefreshToken(tokenHash, {
          ...tokens,
          grantExpiresAt: DateTime.addDuration(yield* DateTime.now, grantLifetime),
        });

        // Replaced since it was read, by another request with the same token: a reuse as well.
        if (!rotated) {
          yield* grants.revoke(grant.id);

          return yield* invalidRefreshToken;
        }

        return tokens.response;
      });

      const activeGrantsOf = (userId: UserId) =>
        Effect.gen(function* () {
          const now = yield* DateTime.now;

          return (yield* grants.listOf(userId)).filter((grant) =>
            DateTime.isLessThan(now, grant.expiresAt),
          );
        });

      return Grants.of({
        exchange: Effect.fn("Grants.exchange")(function* (params, ip) {
          const failures = AttemptCounter.tokenFailuresOfIp(ip);
          // Counted as a failure before it is tried, in one step with the refusal, so concurrent guesses do not
          // all get through; given back unless it fails as one.
          yield* limiter.take([failures]);

          return yield* Effect.gen(function* () {
            const secrets = yield* secretsOf(params);

            return yield* secrets._tag === "Code"
              ? exchangeCode(params, secrets)
              : refresh(params, secrets.refreshToken);
          }).pipe(
            Effect.onExit((exit) =>
              isCountedFailure(exit) ? Effect.void : limiter.giveBack(failures),
            ),
          );
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

          const user = yield* revokeUnlessLive(grant);

          if (Option.isNone(user)) return yield* new Unauthenticated();

          if (
            grant.lastUsedAt === null ||
            DateTime.isGreaterThanOrEqualTo(
              now,
              DateTime.addDuration(grant.lastUsedAt, lastUseResolution),
            )
          ) {
            yield* grants.markUsed(grant.id, now);
          }

          const ofRole = [...rolePermissions(user.value.role)];

          return {
            user: user.value,
            permissions: new Set(held(accessToken.permissions, grant.permissions, ofRole)),
          };
        }),
        listOf: Effect.fn("Grants.listOf")(function* (userId) {
          return yield* activeGrantsOf(userId);
        }),
        changePermissions: Effect.fn("Grants.changePermissions")(
          function* (userId, grantId, permissions) {
            const notGrantable = permissions.find(
              (permission) => !grantablePermissions.some((grantable) => grantable === permission),
            );

            if (notGrantable !== undefined) {
              return yield* new PermissionNotGrantable({ permission: notGrantable });
            }

            const notFound = new GrantNotFound({ id: grantId });

            if (!(yield* activeGrantsOf(userId)).some(({ id }) => id === grantId)) {
              return yield* notFound;
            }

            // Revoked since it was read: not found either.
            return yield* Effect.fromOption(
              yield* grants.changePermissionsOf(
                userId,
                grantId,
                grantablePermissions.filter((permission) => permissions.includes(permission)),
              ),
              () => notFound,
            );
          },
        ),
        revoke: Effect.fn("Grants.revoke")(function* (userId, grantId) {
          // Another User's Grant is not found, so the API never tells it exists.
          if (!(yield* grants.revokeOf(userId, grantId))) {
            return yield* new GrantNotFound({ id: grantId });
          }
        }),
      });
    }),
  );
}
