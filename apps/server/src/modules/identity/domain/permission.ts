import { Permission } from "@quack/contracts/permission";
import { TodosPermission } from "@quack/contracts/todos/todos-permissions";
import type { Role } from "@quack/contracts/identity/user";

const permissionsOf: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  user: new Set(TodosPermission.literals),
  admin: new Set(Permission.literals),
};

export const roleAllows = (role: Role, permission: Permission) =>
  permissionsOf[role].has(permission);
