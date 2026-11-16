import { Team } from "@quack/contracts/identity/profile";
import type { UserOrder } from "@quack/contracts/users/users-api";

import type { UsersSearch } from "#/features/users/admin/users-search.ts";

export const usersFilterKeys = ["status", "role", "team"] as const;
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
  status: {
    title: "Status",
    options: [
      { value: "active", label: "Active" },
      { value: "invited", label: "Invited" },
      { value: "suspended", label: "Suspended" },
    ],
  },
  role: {
    title: "Role",
    options: [
      { value: "admin", label: "Admin" },
      { value: "user", label: "User" },
    ],
  },
  team: {
    title: "Team",
    options: Team.literals.map((value) => ({
      value,
      label: value.slice(0, 1).toUpperCase() + value.slice(1),
    })),
  },
};

export const labelOf = <Key extends UsersFilterKey>(
  key: Key,
  value: NonNullable<UsersSearch[Key]>,
) => usersFilters[key].options.find((option) => option.value === value)?.label ?? value;

// The email and the name have their own filter, the search above the table. A column with none offers no filter.
export const usersFilterOfColumn: {
  readonly [Column in UserOrder]?: "search" | UsersFilterKey;
} = {
  email: "search",
  name: "search",
  status: "status",
  role: "role",
  team: "team",
};
