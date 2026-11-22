import { Badge } from "@quack/ui/components/badge";
import { DataTable, type DataTableColumnFor } from "@quack/ui/components/data-table/data-table";
import { DataTableEmptyState } from "@quack/ui/components/data-table/states";
import { DataTableToolbar } from "@quack/ui/components/data-table/toolbar";
import { useDataTable } from "@quack/ui/hooks/use-data-table";
import type { DataTableBaseState } from "@quack/ui/lib/data-table/state";
import { useEffect, useMemo, useRef, useState } from "react";

import { absolute, type Grant, relative } from "#/features/prototype-grants/grants-data.ts";
import { GrantsEmpty } from "#/features/prototype-grants/grants-empty.tsx";
import { PermissionBadges } from "#/features/prototype-grants/permission-badge.tsx";
import { RevokeDialog } from "#/features/prototype-grants/revoke-dialog.tsx";

type SortColumn = "clientName" | "lastUsedAt" | "expiresAt";
type State = DataTableBaseState<SortColumn>;

const sorters: Record<SortColumn, (a: Grant, b: Grant) => number> = {
  clientName: (a, b) => a.clientName.localeCompare(b.clientName),
  lastUsedAt: (a, b) => a.lastUsedAt - b.lastUsedAt,
  expiresAt: (a, b) => a.expiresAt - b.expiresAt,
};

export function VariantA({
  grants,
  onRevoke,
}: {
  grants: Grant[];
  onRevoke: (id: string) => void;
}) {
  if (grants.length === 0) return <GrantsEmpty />;
  return <GrantsTable grants={grants} onRevoke={onRevoke} />;
}

function GrantsTable({ grants, onRevoke }: { grants: Grant[]; onRevoke: (id: string) => void }) {
  const [state, setState] = useState<State>({});
  const table = useDataTable<State>({
    store: { state, update: (next) => setState(next) },
    defaultSorting: { column: "lastUsedAt", direction: "desc" },
  });

  const term = (state.q ?? "").trim().toLowerCase();
  const { column, direction } = table.sorting;
  const rows = grants
    .filter(
      (grant) =>
        term === "" ||
        grant.clientName.toLowerCase().includes(term) ||
        grant.origin.toLowerCase().includes(term),
    )
    .toSorted((a, b) => sorters[column](a, b) * (direction === "asc" ? 1 : -1));

  const revoke = useRef(onRevoke);
  useEffect(() => {
    revoke.current = onRevoke;
  });
  const columns = useMemo<ReadonlyArray<DataTableColumnFor<Grant, State>>>(
    () => [
      {
        id: "clientName",
        title: "AI Client",
        sortable: true,
        filter: "search",
        cell: ({ row }) => (
          <div className="flex flex-col gap-1 py-1">
            <span className="font-medium">{row.original.clientName}</span>
            <span className="text-xs text-muted-foreground">from {row.original.origin}</span>
            {row.original.loopbackOnly ? (
              <Badge variant="outline" className="w-fit">
                Runs on this machine
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        id: "permissions",
        title: "Permissions",
        cell: ({ row }) => <PermissionBadges permissions={row.original.permissions} />,
      },
      {
        id: "givenAt",
        title: "Given",
        cell: ({ row }) => absolute(row.original.givenAt),
      },
      {
        id: "lastUsedAt",
        title: "Last used",
        sortable: true,
        cell: ({ row }) => relative(row.original.lastUsedAt),
      },
      {
        id: "expiresAt",
        title: "Expires",
        sortable: true,
        cell: ({ row }) => relative(row.original.expiresAt),
      },
      {
        id: "actions",
        shrink: true,
        sticky: "end",
        cell: ({ row }) => (
          <RevokeDialog grant={row.original} onRevoke={() => revoke.current(row.original.id)} />
        ),
      },
    ],
    [],
  );

  return (
    <>
      <DataTableToolbar
        table={table}
        search={{
          "aria-label": "Search AI Clients by name or origin",
          placeholder: "Search AI Clients",
          maxLength: 100,
        }}
      />
      <DataTable
        table={table}
        columns={columns}
        data={rows}
        getRowId={(grant) => grant.id}
        label="AI Clients"
        empty={
          <DataTableEmptyState searchTerm={state.q?.trim() ?? ""} onReset={table.reset}>
            No AI Client
          </DataTableEmptyState>
        }
      />
    </>
  );
}
