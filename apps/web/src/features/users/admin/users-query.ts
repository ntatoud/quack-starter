import { defaultPageSize } from "@quack/contracts/pagination/paginated";
import { keepPreviousData } from "@tanstack/react-query";

import type { UsersQuery } from "#/features/users/admin/users-search.ts";
import { api } from "#/lib/api.ts";

export const usersQueryOptions = ({ page, search, status, role, team, orderBy, dir }: UsersQuery) =>
  api.users.list.queryOptions({
    input: {
      query: {
        page,
        pageSize: defaultPageSize,
        orderBy,
        dir,
        ...(search === "" ? {} : { search }),
        ...(status === undefined ? {} : { status }),
        ...(role === undefined ? {} : { role }),
        ...(team === undefined ? {} : { team }),
      },
    },
    placeholderData: keepPreviousData,
  });
