import { Skeleton } from "@quack/ui/components/skeleton";
import { matchQuery } from "@quack/ui-state/query";
import { useQuery } from "@tanstack/react-query";

import { LoadFailed } from "#/components/load-failed.tsx";
import { EmailChangeForm } from "#/features/email-change/email-change-form.tsx";
import { PendingEmailChange } from "#/features/email-change/pending-email-change.tsx";
import { api } from "#/lib/api.ts";

/** Loaded apart from the Current User of the route: only this page needs the pending email. */
export function EmailSettingsPage() {
  const me = useQuery(api.identity.me.queryOptions());

  return matchQuery(me, {
    Pending: () => (
      <>
        <p role="status" className="sr-only">
          Loading your email…
        </p>
        <Skeleton aria-hidden="true" className="h-48 rounded-xl" />
      </>
    ),
    Error: () => (
      <LoadFailed
        title="Could not load your email"
        retrying={me.isFetching}
        onRetry={() => me.refetch()}
      />
    ),
    Success: ({ data }) => (
      <>
        {data.pendingEmail !== null && <PendingEmailChange pendingEmail={data.pendingEmail} />}
        <EmailChangeForm currentEmail={data.email} />
      </>
    ),
  });
}
