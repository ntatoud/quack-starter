import { Badge } from "@quack/ui/components/badge";
import { CircleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  actions,
  daysLeft,
  type Grant,
  idleDays,
  relative,
} from "#/features/prototype-grants/grants-data.ts";
import { GrantsEmpty } from "#/features/prototype-grants/grants-empty.tsx";
import { RevokeDialog } from "#/features/prototype-grants/revoke-dialog.tsx";

const reasonsOf = (grant: Grant) => [
  ...(daysLeft(grant) <= 7 ? [`Expires ${relative(grant.expiresAt)} if unused`] : []),
  ...(grant.loopbackOnly ? ["Runs on this machine"] : []),
  ...(idleDays(grant) >= 14 ? [`Unused since ${relative(grant.lastUsedAt)}`] : []),
];

export function VariantC({
  grants,
  onRevoke,
}: {
  grants: Grant[];
  onRevoke: (id: string) => void;
}) {
  if (grants.length === 0) return <GrantsEmpty />;
  const flagged = grants.filter((grant) => reasonsOf(grant).length > 0);
  const active = grants.filter((grant) => reasonsOf(grant).length === 0);

  return (
    <div className="flex flex-col gap-6">
      {flagged.length > 0 ? (
        <Group title="Needs a look" icon>
          {flagged.map((grant) => (
            <Entry key={grant.id} grant={grant} reasons={reasonsOf(grant)} onRevoke={onRevoke} />
          ))}
        </Group>
      ) : null}
      {active.length > 0 ? (
        <Group title="Active">
          {active.map((grant) => (
            <Entry key={grant.id} grant={grant} reasons={[]} onRevoke={onRevoke} />
          ))}
        </Group>
      ) : null}
    </div>
  );
}

function Group({ title, icon, children }: { title: string; icon?: boolean; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        {icon ? <CircleAlertIcon aria-hidden className="size-4 text-amber-600" /> : null}
        {title}
      </h2>
      <ul className="divide-y rounded-xl border bg-card">{children}</ul>
    </section>
  );
}

function Entry({
  grant,
  reasons,
  onRevoke,
}: {
  grant: Grant;
  reasons: string[];
  onRevoke: (id: string) => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm">
          <strong className="font-medium">{grant.clientName}</strong>{" "}
          <span className="text-muted-foreground">from {grant.origin}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Can {actions(grant.permissions)}. Used {relative(grant.lastUsedAt)}.
        </p>
        {reasons.length > 0 ? (
          <ul className="flex flex-wrap gap-1">
            {reasons.map((reason) => (
              <li key={reason}>
                <Badge
                  variant="outline"
                  className="border-amber-600/50 text-amber-700 dark:text-amber-400"
                >
                  {reason}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <RevokeDialog grant={grant} onRevoke={() => onRevoke(grant.id)} />
    </li>
  );
}
