import { keepPreviousData } from "@tanstack/react-query";

import { api } from "#/lib/api.ts";

export const usersPageSize = 20;

export const usersQueryOptions = (page: number) =>
  api.users.list.queryOptions({
    input: { query: { page, pageSize: usersPageSize, orderBy: "email", dir: "asc" } },
    placeholderData: keepPreviousData,
  });
