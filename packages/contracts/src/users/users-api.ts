import { Effect, Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import { Forbidden } from "#/identity/identity-errors.ts";
import { User } from "#/identity/user.ts";

const Page = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

const PageSize = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 }));

export const UsersPageQuery = Schema.Struct({
  page: Page.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
  pageSize: PageSize.pipe(Schema.withDecodingDefaultKey(Effect.succeed(20))),
});
export type UsersPageQuery = typeof UsersPageQuery.Type;

export class UsersPage extends Schema.Class<UsersPage, { readonly brand: unique symbol }>(
  "UsersPage",
)({
  items: Schema.Array(User),
  /** Every User, not only those of the page. */
  total: Schema.Int,
}) {}

export class UsersApi extends HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("list", "/", {
      query: UsersPageQuery,
      success: UsersPage,
      error: Forbidden.pipe(HttpApiSchema.status(403)),
    }),
  )
  .middleware(Authentication)
  .prefix("/users") {}
