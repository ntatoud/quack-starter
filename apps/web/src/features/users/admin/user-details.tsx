import type { User, UserId } from "@quack/contracts/identity/user";
import { Button } from "@quack/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@quack/ui/components/empty";
import { SettingsCard } from "@quack/ui/components/settings-card";
import { Skeleton } from "@quack/ui/components/skeleton";
import { matchQuery } from "@quack/ui-state/query";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ButtonLink } from "#/components/button-link.tsx";
import { userQueryOptions } from "#/features/users/admin/users-query.ts";
import {
  CountryCell,
  DateCell,
  OnboardedCell,
  RoleBadge,
  StatusBadge,
  TimeAgoCell,
} from "#/features/users/admin/users-cells.tsx";
import { labelOf } from "#/features/users/admin/users-filters.ts";
import { userLabel } from "#/features/users/full-name.ts";
import { UserAvatar } from "#/features/users/user-avatar.tsx";

export function UserDetails({ id }: { id: UserId }) {
  const user = useQuery(userQueryOptions(id));

  return matchQuery(user, {
    Pending: () => (
      <>
        <p role="status" className="sr-only">
          Loading the user…
        </p>
        <div aria-hidden="true" className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <Skeleton aria-hidden="true" className="h-36 rounded-xl" />
      </>
    ),
    Error: ({ error }) =>
      error._tag === "UserNotFound" ? (
        <Empty className="border border-dashed">
          <EmptyHeader role="alert">
            <EmptyTitle>No such user</EmptyTitle>
            <EmptyDescription>They may have been removed, or the link is wrong.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <ButtonLink to="/admin/users" variant="outline" size="sm">
              See every user
            </ButtonLink>
          </EmptyContent>
        </Empty>
      ) : (
        <Empty className="border border-dashed">
          <EmptyHeader role="alert">
            <EmptyTitle>Could not load the user</EmptyTitle>
            <EmptyDescription>Check your connection and try again.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              size="sm"
              disabled={user.isFetching}
              onClick={() => user.refetch()}
            >
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      ),
    // Relative dates count from when the User was fetched, so the render stays pure.
    Success: ({ data }) => <UserOverview user={data} now={new Date(user.dataUpdatedAt)} />,
  });
}

function UserOverview({ user, now }: { user: User; now: Date }) {
  const { profile } = user;

  return (
    <>
      <section aria-label="Summary" className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <UserAvatar user={user} className="size-16 rounded-xl after:rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="truncate text-lg font-semibold">{userLabel(user)}</h2>
          {profile !== null && (
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          )}
          <div className="mt-1 flex gap-2">
            <StatusBadge status={user.status} />
            <RoleBadge role={user.role} />
          </div>
        </div>
      </section>
      <Facts title="Profile">
        {profile === null ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">No profile yet.</p>
        ) : (
          <>
            <Fact term="Team">
              {profile.team === null ? <NoValue /> : labelOf("team", profile.team)}
            </Fact>
            <Fact term="Job title">{profile.jobTitle || <NoValue />}</Fact>
            <Fact term="Country">
              {profile.country === null ? <NoValue /> : <CountryCell code={profile.country} />}
            </Fact>
          </>
        )}
      </Facts>
      <Facts title="Activity">
        <Fact term="Created">
          <DateCell date={user.createdAt} />
        </Fact>
        <Fact term="Onboarded">
          <OnboardedCell date={user.onboardedAt} />
        </Fact>
        <Fact term="Last sign-in">
          <TimeAgoCell date={user.lastSignInAt} now={now} />
        </Fact>
      </Facts>
    </>
  );
}

function Facts({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">{title}</h3>
      <SettingsCard>{children}</SettingsCard>
    </section>
  );
}

// `data-slot="field"` makes it a row of the card, as a `Field` of a form is.
function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <dl data-slot="field" className="text-sm">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="min-w-0 font-medium break-words">{children}</dd>
    </dl>
  );
}

function NoValue() {
  return <span className="font-normal text-muted-foreground">None</span>;
}
