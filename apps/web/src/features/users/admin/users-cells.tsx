import type { User, UserStatus } from "@quack/contracts/identity/user";
import { Badge } from "@quack/ui/components/badge";
import { DateTime } from "effect";
import { CircleCheckIcon } from "lucide-react";

import { labelOf } from "#/features/users/admin/users-filters.ts";
import { fullName } from "#/features/users/full-name.ts";
import { UserAvatar } from "#/features/users/user-avatar.tsx";

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

export function StatusBadge({ status }: { status: UserStatus }) {
  const label = labelOf("status", status);
  switch (status) {
    case "active":
      return (
        <Badge variant="outline">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
          {label}
        </Badge>
      );
    case "invited":
      return <Badge variant="secondary">{label}</Badge>;
    case "suspended":
      return <Badge variant="destructive">{label}</Badge>;
  }
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

export function VerifiedCell({ verifiedAt }: { verifiedAt: DateTime.Utc | null }) {
  return verifiedAt === null ? (
    <span className="text-muted-foreground">
      <span aria-hidden="true">–</span>
      <span className="sr-only">Not verified</span>
    </span>
  ) : (
    <CircleCheckIcon role="img" aria-label="Verified" className="size-4 text-emerald-600" />
  );
}

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const units: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

/** In the largest unit that fits: "3 days ago", "last month". */
const timeAgo = (date: Date, now: Date) => {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit);
  }
  return relativeFormat.format(0, "minute");
};

export function DateCell({ date }: { date: DateTime.Utc }) {
  const value = DateTime.toDateUtc(date);
  return (
    <time dateTime={value.toISOString()} className="whitespace-nowrap">
      {dateFormat.format(value)}
    </time>
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
      {timeAgo(value, now)}
    </time>
  );
}
