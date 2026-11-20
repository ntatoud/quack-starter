import { Team } from "@quack/contracts/identity/profile";
import { Role, UserStatus } from "@quack/contracts/identity/user";
import { defaultPageSize } from "@quack/contracts/pagination/paginated";
import { UserOrder } from "@quack/contracts/users/users-api";

import {
  type DataTableSearch,
  dataTableSearchSchema,
} from "#/components/data-table/search-schema.ts";

export const usersPageSizes = [10, defaultPageSize, 50, 100] as const;

export const defaultUsersSorting = { column: "email", direction: "asc" } as const;

export const UsersSearch = dataTableSearchSchema({
  columns: UserOrder.literals,
  pageSizes: usersPageSizes,
  filters: { status: UserStatus, role: Role, team: Team },
});
export type UsersSearch = DataTableSearch<typeof UsersSearch>;
