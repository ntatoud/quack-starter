import { Team } from "@quack/contracts/identity/profile";
import { Role, UserStatus } from "@quack/contracts/identity/user";
import { SortDirection } from "@quack/contracts/sorting/sorting";
import { UserOrder } from "@quack/contracts/users/users-api";
import { Effect, Schema } from "effect";

import { PageSearch } from "#/components/page-pagination.tsx";

export const defaultUsersSorting = { orderBy: "email", dir: "asc" } as const;

const optionalFilter = <S extends Schema.Top>(schema: S) =>
  Schema.optional(
    Schema.UndefinedOr(schema).pipe(Schema.catchDecoding(() => Effect.succeedSome(undefined))),
  );

// An invalid value is replaced, not dropped: the router keeps the raw value of a key that validation drops.
// The router parses `?q=42` as a number: such a search is a search for nothing, not an invalid page.
export const UsersSearch = Schema.Struct({
  ...PageSearch.fields,
  q: Schema.optional(Schema.String.pipe(Schema.catchDecoding(() => Effect.succeedSome("")))),
  status: optionalFilter(UserStatus),
  role: optionalFilter(Role),
  team: optionalFilter(Team),
  orderBy: Schema.optional(
    UserOrder.pipe(Schema.catchDecoding(() => Effect.succeedSome(defaultUsersSorting.orderBy))),
  ),
  dir: Schema.optional(
    SortDirection.pipe(Schema.catchDecoding(() => Effect.succeedSome(defaultUsersSorting.dir))),
  ),
});
export type UsersSearch = typeof UsersSearch.Type;

/** The list a URL asks for, its defaults filled in: the URL leaves them out, so a list has one URL. */
export type UsersQuery = ReturnType<typeof usersQueryOf>;

export const usersQueryOf = ({
  page = 1,
  q = "",
  status,
  role,
  team,
  orderBy = defaultUsersSorting.orderBy,
  dir = defaultUsersSorting.dir,
}: UsersSearch) => ({ page, search: q.trim(), status, role, team, orderBy, dir });

export const isFiltered = ({ search, status, role, team }: UsersQuery) =>
  search !== "" || status !== undefined || role !== undefined || team !== undefined;
