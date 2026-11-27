import { booleanFilter, selectFilter } from "@quack/ui/data-table";

import type { UsersSearch } from "#/features/users/admin/users-search.ts";
import { teamOptions } from "#/features/identity/team-options.ts";

export type UsersFilterKey = "status" | "role" | "team";

type UsersFilterOptions = {
  readonly [Key in UsersFilterKey]: ReadonlyArray<{
    readonly value: NonNullable<UsersSearch[Key]>;
    readonly label: string;
  }>;
};

const usersFilterOptions: UsersFilterOptions = {
  status: [
    { value: "active", label: "Active" },
    { value: "invited", label: "Invited" },
    { value: "suspended", label: "Suspended" },
  ],
  role: [
    { value: "admin", label: "Admin" },
    { value: "user", label: "User" },
  ],
  team: teamOptions,
};

export const labelOf = <Key extends UsersFilterKey>(
  key: Key,
  value: NonNullable<UsersSearch[Key]>,
) => usersFilterOptions[key].find((option) => option.value === value)?.label ?? value;

export const usersFilters = {
  status: selectFilter({ title: "Status", options: usersFilterOptions.status }),
  role: selectFilter({ title: "Role", options: usersFilterOptions.role }),
  team: selectFilter({ title: "Team", options: usersFilterOptions.team }),
  onboarded: booleanFilter({ title: "Onboarded" }),
};
