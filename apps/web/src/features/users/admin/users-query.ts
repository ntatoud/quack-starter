import { defaultPageSize } from "@quack/contracts/pagination/paginated";
import { keepPreviousData } from "@tanstack/react-query";

import { api } from "#/lib/api.ts";

export const usersQueryOptions = (page: number) =>
  api.users.list.queryOptions({
    input: { query: { page, pageSize: defaultPageSize, orderBy: "email", dir: "asc" } },
    placeholderData: keepPreviousData,
  });
