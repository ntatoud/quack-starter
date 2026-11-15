import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import { RequireRole } from "#/identity/require-role.ts";
import { User } from "#/identity/user.ts";
import { Page, PageQuery } from "#/pagination/page.ts";

export class UsersPage extends Schema.Class<UsersPage, { readonly brand: unique symbol }>(
  "UsersPage",
)(Page(User).fields) {}

export class UsersApi extends HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("list", "/", {
      query: PageQuery,
      success: UsersPage,
    }),
  )
  .middleware(RequireRole("admin"))
  .middleware(Authentication)
  .prefix("/users") {}
