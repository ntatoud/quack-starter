import { Api } from "@quack/contracts/api";
import { Grant, GrantId } from "@quack/contracts/grants/grant";
import { CurrentUser } from "@quack/contracts/identity/authentication";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import type { Grant as StoredGrant } from "#/modules/identity/domain/grant.ts";

import { Grants } from "#/modules/identity/application/grants.ts";
import { isLoopback } from "#/modules/identity/domain/redirect-uri.ts";

const grantOf = (grant: StoredGrant) =>
  new Grant({
    id: GrantId.make(grant.id),
    aiClient: {
      id: grant.aiClientId,
      host: new URL(grant.aiClientId).hostname,
      name: grant.aiClientName,
    },
    loopbackOnly: isLoopback(new URL(grant.redirectUri)),
    permissions: grant.permissions,
    lastUsedAt: grant.lastUsedAt,
    expiresAt: grant.expiresAt,
  });

export const GrantsHandlers = HttpApiBuilder.group(
  Api,
  "grants",
  Effect.fn(function* (handlers) {
    const grants = yield* Grants;

    return handlers.handleAll({
      list: Effect.fn(function* () {
        const user = yield* CurrentUser;

        return (yield* grants.listOf(user.id)).map(grantOf);
      }),
      changePermissions: Effect.fn(function* ({ params, payload }) {
        const user = yield* CurrentUser;

        return grantOf(yield* grants.changePermissions(user.id, params.id, payload.permissions));
      }),
      revoke: Effect.fn(function* ({ params }) {
        const user = yield* CurrentUser;

        yield* grants.revoke(user.id, params.id);
      }),
    });
  }),
);
