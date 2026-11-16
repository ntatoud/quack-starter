import type { UserOrder } from "@quack/contracts/users/users-api";

import type { UsersSearch } from "#/features/users/admin/users-search.ts";

export const usersFilterKeys = ["role"] as const;
export type UsersFilterKey = (typeof usersFilterKeys)[number];

export const usersFilters: {
  readonly [Key in UsersFilterKey]: {
    readonly title: string;
    readonly options: ReadonlyArray<{
      readonly value: NonNullable<UsersSearch[Key]>;
      readonly label: string;
    }>;
  };
} = {
  role: {
    title: "Role",
    options: [
      { value: "admin", label: "Admin" },
      { value: "user", label: "User" },
    ],
  },
};

export const labelOf = <Key extends UsersFilterKey>(
  key: Key,
  value: NonNullable<UsersSearch[Key]>,
) => usersFilters[key].options.find((option) => option.value === value)?.label ?? value;

// The email has its own filter, the search above the table. A column with none offers no filter.
export const usersFilterOfColumn: {
  readonly [Column in UserOrder]?: "search" | UsersFilterKey;
} = {
  email: "search",
  role: "role",
};
