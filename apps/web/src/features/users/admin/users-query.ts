import { keepPreviousData } from "@tanstack/react-query";

import type { UsersTable } from "#/features/users/admin/users-table.ts";
import { api } from "#/lib/api.ts";

export const usersQueryOptions = ({ state, page, pageSize, sorting }: UsersTable) => {
  const search = state.q?.trim() ?? "";
  return api.users.list.queryOptions({
    input: {
      query: {
        page,
        pageSize,
        orderBy: sorting.column,
        dir: sorting.direction,
        ...(search === "" ? {} : { search }),
        ...(state.status === undefined ? {} : { status: state.status }),
        ...(state.role === undefined ? {} : { role: state.role }),
        ...(state.team === undefined ? {} : { team: state.team }),
      },
    },
    placeholderData: keepPreviousData,
  });
};
