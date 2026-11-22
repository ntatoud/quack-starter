import { Badge } from "@quack/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@quack/ui/components/table";

import {
  absolute,
  type Grant,
  permissionLabel,
  relative,
} from "#/features/prototype-grants/grants-data.ts";
import { GrantsEmpty } from "#/features/prototype-grants/grants-empty.tsx";
import { RevokeDialog } from "#/features/prototype-grants/revoke-dialog.tsx";

export function VariantA({
  grants,
  onRevoke,
}: {
  grants: Grant[];
  onRevoke: (id: string) => void;
}) {
  if (grants.length === 0) return <GrantsEmpty />;
  return (
    <TableContainer>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>AI Client</TableHead>
            <TableHead>Can</TableHead>
            <TableHead>Given</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grants.map((grant) => (
            <TableRow key={grant.id}>
              <TableCell>
                <div className="font-medium">{grant.clientName}</div>
                <div className="text-xs text-muted-foreground">from {grant.origin}</div>
                {grant.loopbackOnly ? (
                  <Badge variant="outline" className="mt-1">
                    Runs on this machine
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell>
                <ul className="flex flex-wrap gap-1">
                  {grant.permissions.map((permission) => (
                    <li key={permission}>
                      <Badge variant="secondary">{permissionLabel[permission]}</Badge>
                    </li>
                  ))}
                </ul>
              </TableCell>
              <TableCell className="text-muted-foreground">{absolute(grant.givenAt)}</TableCell>
              <TableCell>{relative(grant.lastUsedAt)}</TableCell>
              <TableCell>{relative(grant.expiresAt)}</TableCell>
              <TableCell className="text-right">
                <RevokeDialog grant={grant} onRevoke={() => onRevoke(grant.id)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
