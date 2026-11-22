import type { UserId } from "@quack/contracts/identity/user";
import type { UserListQuery } from "@quack/contracts/users/users-api";
import { keepPreviousData } from "@tanstack/react-query";
import type { Types } from "effect";

import type { UsersTable } from "#/features/users/admin/users-table.ts";
import { api } from "#/lib/api.ts";

export const usersQueryOptions = ({ state, page, pageSize, sorting }: UsersTable) => {
  const search = state.q?.trim() ?? "";

  // A filter that is not set stays out of the query, since an absent property is not an `undefined` one.
  const query: Types.Mutable<UserListQuery> = {
    page,
    pageSize,
    orderBy: sorting.column,
    dir: sorting.direction,
  };

  if (search !== "") query.search = search;

  if (state.status !== undefined) query.status = state.status;

  if (state.role !== undefined) query.role = state.role;

  if (state.team !== undefined) query.team = state.team;

  if (state.onboarded !== undefined) query.onboarded = state.onboarded;

  return api.users.list.queryOptions({
    input: { query },
    placeholderData: keepPreviousData,
  });
};

export const userQueryOptions = (id: UserId) =>
  api.users.get.queryOptions({ input: { params: { id } } });
