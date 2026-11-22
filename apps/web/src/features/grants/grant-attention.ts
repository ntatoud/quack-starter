import type { Grant } from "@quack/contracts/grants/grant";
import { DateTime, Duration } from "effect";

import { timeAgo } from "#/lib/time-ago.ts";

/** A Grant lasts 30 days from its last refresh: one with a week left has not been used for three. */
const expiresSoon = Duration.days(7);

/** Why a Grant needs a look from its User, if it does: an empty list for one that does not. */
export const attentionOf = (grant: Grant, now: Date): ReadonlyArray<string> => {
  const expiresAt = DateTime.toDateUtc(grant.expiresAt);

  return [
    ...(expiresAt.getTime() - now.getTime() <= Duration.toMillis(expiresSoon)
      ? [`Expires ${timeAgo(expiresAt, now)} if unused`]
      : []),
    ...(grant.loopbackOnly ? ["Runs on this machine"] : []),
  ];
};
