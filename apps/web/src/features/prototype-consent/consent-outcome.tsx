import { Button } from "@quack/ui/components/button";
import { useState } from "react";

import {
  type ConsentRequest,
  type PermissionName,
  fakeCallback,
} from "#/features/prototype-consent/consent-stub.ts";

export type Outcome =
  | { kind: "approved"; granted: PermissionName[]; url: string }
  | { kind: "denied"; url: string }
  | { kind: "switch-account" };

export function useConsentOutcome(request: ConsentRequest) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  return {
    outcome,
    approve: (granted: PermissionName[]) =>
      setOutcome({ kind: "approved", granted, url: fakeCallback(request, "code") }),
    deny: () => setOutcome({ kind: "denied", url: fakeCallback(request, "denied") }),
    switchAccount: () => setOutcome({ kind: "switch-account" }),
    reset: () => setOutcome(null),
  };
}

/** What would happen, since the prototype calls nothing. */
export function OutcomePanel({
  outcome,
  onReset,
}: {
  outcome: Outcome | null;
  onReset: () => void;
}) {
  if (outcome === null) return null;
  return (
    <div
      role="status"
      className="mt-4 rounded-lg border border-dashed border-border bg-muted/50 p-3 text-sm"
    >
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Prototype: what would happen
      </p>
      {outcome.kind === "approved" && (
        <>
          <p className="mt-1">
            A Grant is created for <strong>{outcome.granted.join(", ") || "nothing"}</strong>.
          </p>
          <p className="mt-1 break-all">Would redirect to {outcome.url}</p>
        </>
      )}
      {outcome.kind === "denied" && (
        <>
          <p className="mt-1">No Grant is created.</p>
          <p className="mt-1 break-all">Would redirect to {outcome.url}</p>
        </>
      )}
      {outcome.kind === "switch-account" && (
        <p className="mt-1">
          Would sign out, then lead to /sign-in and back to this page once signed in.
        </p>
      )}
      <Button variant="ghost" size="xs" className="mt-2" onClick={onReset}>
        Dismiss
      </Button>
    </div>
  );
}
