import type { Grant } from "@quack/contracts/grants/grant";
import { Button } from "@quack/ui/components/button";
import { Skeleton } from "@quack/ui/components/skeleton";
import { matchQuery } from "@quack/ui-state/query";
import { useQuery } from "@tanstack/react-query";
import { Option } from "effect";
import { CircleAlertIcon } from "lucide-react";
import { type ReactNode, useId } from "react";

import { LoadFailed } from "#/components/load-failed.tsx";
import { attentionOf } from "#/features/grants/grant-attention.ts";
import { GrantEntry } from "#/features/grants/grant-entry.tsx";
import { GrantsEmpty } from "#/features/grants/grants-empty.tsx";
import { api } from "#/lib/api.ts";

/** The AI Clients that can act for the Current User: those that need a look first, each saying why. */
export function GrantsList() {
  const grants = useQuery(api.grants.list.queryOptions());

  return matchQuery(grants, {
    Pending: () => (
      <>
        <p role="status" className="sr-only">
          Loading AI Clients…
        </p>
        <ul className="divide-y rounded-xl border" aria-hidden="true">
          {[0, 1].map((row) => (
            <li key={row} className="flex flex-col gap-2 px-5 py-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </li>
          ))}
        </ul>
      </>
    ),
    Error: () => (
      <LoadFailed
        title="Could not load your AI Clients"
        retrying={grants.isFetching}
        onRetry={() => grants.refetch()}
      />
    ),
    Success: ({ data, refreshError }) => (
      <div className="flex flex-col gap-6">
        {Option.isSome(refreshError) && (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <span>Could not refresh your AI Clients.</span>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-sm"
              disabled={grants.isFetching}
              onClick={() => grants.refetch()}
            >
              Try again
            </Button>
          </p>
        )}
        {data.length === 0 ? (
          <GrantsEmpty />
        ) : (
          <Groups grants={data} now={new Date(grants.dataUpdatedAt)} />
        )}
      </div>
    ),
  });
}

function Groups({ grants, now }: { grants: ReadonlyArray<Grant>; now: Date }) {
  const entries = grants.map((grant) => ({ grant, attention: attentionOf(grant, now) }));

  const groups = [
    {
      title: "Needs a look",
      icon: <CircleAlertIcon aria-hidden className="size-4 text-warning" />,
      entries: entries.filter(({ attention }) => attention.length > 0),
    },
    { title: "Active", entries: entries.filter(({ attention }) => attention.length === 0) },
  ];

  return groups.flatMap(({ title, icon, entries: grouped }) =>
    grouped.length === 0
      ? []
      : [
          <Group key={title} title={title} icon={icon}>
            {grouped.map((entry) => (
              <GrantEntry key={entry.grant.id} {...entry} now={now} />
            ))}
          </Group>,
        ],
  );
}

function Group({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <h2 id={titleId} className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </h2>
      <ul className="divide-y rounded-xl border">{children}</ul>
    </section>
  );
}
