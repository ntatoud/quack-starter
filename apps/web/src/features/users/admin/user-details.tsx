import type { User, UserId } from "@quack/contracts/identity/user";
import type { UserChanges } from "@quack/contracts/users/users-api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@quack/ui/components/alert-dialog";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { ButtonLink } from "#/components/button-link.tsx";
import { invalidateUsers } from "#/features/users/admin/invalidate-users.ts";
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
import { api } from "#/lib/api.ts";

/** `canChange` is false on the Admin's own page: they cannot change their own access. */
export function UserDetails({ id, canChange }: { id: UserId; canChange: boolean }) {
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
    Success: ({ data }) => (
      <UserOverview user={data} now={new Date(user.dataUpdatedAt)} canChange={canChange} />
    ),
  });
}

function UserOverview({ user, now, canChange }: { user: User; now: Date; canChange: boolean }) {
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
        {canChange && <UserActions user={user} />}
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

type Confirmed = "promote" | "suspend";

function UserActions({ user }: { user: User }) {
  // One for every button: a new change clears the failure of the one before.
  const change = useMutation(api.users.update.mutationOptions(invalidateUsers));
  const [confirming, setConfirming] = useState<Confirmed | null>(null);
  const apply = (payload: UserChanges) =>
    change.mutate({ params: { id: user.id }, payload }, { onSuccess: () => setConfirming(null) });
  const confirmed = (which: Confirmed) => ({
    open: confirming === which,
    onOpenChange: (open: boolean) => {
      change.reset();
      setConfirming(open ? which : null);
    },
    busy: change.isPending,
    failed: change.isError,
  });
  const name = userLabel(user);
  const atOnce = { variant: "outline", size: "sm", disabled: change.isPending } as const;

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {user.role === "admin" ? (
          <Button {...atOnce} onClick={() => apply({ role: "user" })}>
            Remove admin
          </Button>
        ) : (
          <ConfirmButton
            label="Make admin"
            title={`Make ${name} an admin?`}
            description="They will see every user, and can suspend them or change their role."
            {...confirmed("promote")}
            onConfirm={() => apply({ role: "admin" })}
          />
        )}
        {user.status === "active" && (
          <ConfirmButton
            label="Suspend"
            title={`Suspend ${name}?`}
            description="They are signed out at their next request, and cannot sign in until they are reactivated."
            destructive
            {...confirmed("suspend")}
            onConfirm={() => apply({ status: "suspended" })}
          />
        )}
        {user.status === "suspended" && (
          <Button {...atOnce} onClick={() => apply({ status: "active" })}>
            Reactivate
          </Button>
        )}
      </div>
      {/* A change confirmed in a dialog says it failed there. */}
      <ChangeFailed shown={change.isError && confirming === null} />
    </div>
  );
}

function ChangeFailed({ shown }: { shown: boolean }) {
  return (
    <p role="alert" className="text-sm text-destructive empty:hidden">
      {shown ? "Could not change the user. Try again." : ""}
    </p>
  );
}

/** Asks before `onConfirm`, and stays open until it succeeds: a failure is said in the dialog, which can be retried. */
function ConfirmButton({
  label,
  title,
  description,
  destructive = false,
  open,
  onOpenChange,
  busy,
  failed,
  onConfirm,
}: {
  label: string;
  title: string;
  description: string;
  destructive?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  failed: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Closing while the request runs would hide whether it succeeded.
        if (!busy) onOpenChange(next);
      }}
    >
      <AlertDialogTrigger
        render={
          <Button variant={destructive ? "destructive" : "outline"} size="sm" disabled={busy} />
        }
      >
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <ChangeFailed shown={failed} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={onConfirm}
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
