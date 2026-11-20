import { Team } from "@quack/contracts/identity/profile";
import { selectFilter } from "@quack/ui/components/data-table/filters/select-filter";

import type { UsersSearch } from "#/features/users/admin/users-search.ts";

type UsersFilterKey = "status" | "role" | "team";

const usersFilterOptions: {
  readonly [Key in UsersFilterKey]: ReadonlyArray<{
    readonly value: NonNullable<UsersSearch[Key]>;
    readonly label: string;
  }>;
} = {
  status: [
    { value: "active", label: "Active" },
    { value: "invited", label: "Invited" },
    { value: "suspended", label: "Suspended" },
  ],
  role: [
    { value: "admin", label: "Admin" },
    { value: "user", label: "User" },
  ],
  team: Team.literals.map((value) => ({
    value,
    label: value.slice(0, 1).toUpperCase() + value.slice(1),
  })),
};

export const labelOf = <Key extends UsersFilterKey>(
  key: Key,
  value: NonNullable<UsersSearch[Key]>,
) => usersFilterOptions[key].find((option) => option.value === value)?.label ?? value;

export const usersFilters = {
  status: selectFilter({ title: "Status", options: usersFilterOptions.status }),
  role: selectFilter({ title: "Role", options: usersFilterOptions.role }),
  team: selectFilter({ title: "Team", options: usersFilterOptions.team }),
};
