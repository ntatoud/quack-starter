import type { Role, User, UserStatus } from "@quack/contracts/identity/user";
import { Badge } from "@quack/ui/components/badge";
import { cn } from "@quack/ui/lib/utils";
import { DateTime } from "effect";

import { labelOf } from "#/features/users/admin/users-filters.ts";
import { fullName } from "#/features/users/full-name.ts";
import { UserAvatar } from "#/features/users/user-avatar.tsx";
import { timeAgo } from "#/lib/time-ago.ts";

export function NameCell({ user }: { user: User }) {
  const { profile } = user;

  return (
    <div className="flex min-w-40 items-center gap-3">
      <UserAvatar user={user} size="sm" />
      {profile === null ? (
        <span className="text-muted-foreground">No profile</span>
      ) : (
        <span className="truncate font-medium">{fullName(profile)}</span>
      )}
    </div>
  );
}

// A dot marks a Status, a fill a Role: the two badges sit side by side.
const statusDot = {
  active: "bg-emerald-500",
  invited: "bg-amber-500",
  suspended: "bg-destructive",
} satisfies Record<UserStatus, string>;

export function StatusBadge({ status }: { status: UserStatus }) {
  const label = labelOf("status", status);

  return (
    <Badge variant={status === "suspended" ? "destructive" : "outline"}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", statusDot[status])} />
      {label}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return role === "admin" ? <Badge>Admin</Badge> : <Badge variant="secondary">User</Badge>;
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

// A flag is two regional indicator symbols, one per letter of the code.
const flagOf = (code: string) =>
  String.fromCodePoint(...Array.from(code, (letter) => 0x1f1a5 + letter.charCodeAt(0)));

export function CountryCell({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden="true">{flagOf(code)}</span>
      {regionNames.of(code) ?? code}
    </span>
  );
}

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function DateCell({ date }: { date: DateTime.Utc }) {
  const value = DateTime.toDateUtc(date);

  return (
    <time dateTime={value.toISOString()} className="whitespace-nowrap">
      {dateFormat.format(value)}
    </time>
  );
}

export function OnboardedCell({ date }: { date: DateTime.Utc | null }) {
  return date === null ? (
    <span className="text-muted-foreground">Not yet</span>
  ) : (
    <DateCell date={date} />
  );
}

export function TimeAgoCell({ date, now }: { date: DateTime.Utc | null; now: Date }) {
  if (date === null) return <span className="text-muted-foreground">Never</span>;
  const value = DateTime.toDateUtc(date);

  return (
    <time
      dateTime={value.toISOString()}
      title={dateTimeFormat.format(value)}
      className="whitespace-nowrap"
    >
      {capitalized(timeAgo(value, now))}
    </time>
  );
}
