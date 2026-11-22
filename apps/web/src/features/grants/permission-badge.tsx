import type { Permission } from "@quack/contracts/permission";
import { Badge } from "@quack/ui/components/badge";

export function PermissionBadge({ permission }: { permission: Permission }) {
  // What a delete removes, a User cannot get back.
  return (
    <Badge variant={permission.endsWith(":delete") ? "destructive" : "secondary"}>
      {permission}
    </Badge>
  );
}
