import { Badge } from "@quack/ui/components/badge";

import { type Permission, permissionLabel } from "#/features/prototype-grants/grants-data.ts";

export function PermissionBadges({ permissions }: { permissions: Permission[] }) {
  return (
    <ul className="flex flex-wrap gap-1">
      {permissions.map((permission) => (
        <li key={permission}>
          <Badge variant={permission === "todos:delete" ? "destructive" : "secondary"}>
            {permissionLabel[permission]}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
