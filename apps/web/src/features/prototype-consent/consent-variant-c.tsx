import { Button } from "@quack/ui/components/button";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import { Callout } from "#/features/prototype-consent/consent-callouts.tsx";
import { OutcomePanel, useConsentOutcome } from "#/features/prototype-consent/consent-outcome.tsx";
import { SignedInAs } from "#/features/prototype-consent/consent-signed-in-as.tsx";
import {
  type ConsentRequest,
  allLoopback,
  hostOf,
  newPermissions,
  permissions,
  redirectHosts,
  verbPhrase,
  warningCopy,
} from "#/features/prototype-consent/consent-stub.ts";

/** One sentence as the centrepiece, the details one click away. */
export function ConsentVariantC({ request }: { request: ConsentRequest }) {
  const { outcome, approve, deny, switchAccount, reset } = useConsentOutcome(request);
  const [open, setOpen] = useState(false);
  const origin = hostOf(request.clientId);
  const fresh = newPermissions(request);
  const stepUp = request.alreadyGranted.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-8 text-center">
      <h1 className="text-3xl leading-snug font-semibold tracking-tight">
        {request.clientName}, from <span className="underline decoration-2">{origin}</span>,{" "}
        {stepUp ? "now also wants to " : "wants to "}
        {verbPhrase(stepUp ? fresh : request.requested)} your todos
      </h1>
      <div className="flex flex-col gap-2 text-left">
        {allLoopback(request) ? (
          <Callout tone="warning" title="Runs on this machine">
            {warningCopy.loopback}
          </Callout>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            The name “{request.clientName}” is not verified.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          className="h-12 w-full text-base"
          onClick={() => approve(request.requested)}
        >
          Approve
        </Button>
        <Button variant="ghost" onClick={deny}>
          Deny
        </Button>
      </div>
      <div className="text-left">
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls="consent-details"
          onClick={() => setOpen((value) => !value)}
        >
          Details
          <ChevronDownIcon aria-hidden className={open ? "rotate-180" : ""} />
        </Button>
        {open && (
          <div
            id="consent-details"
            className="mt-2 flex flex-col gap-3 rounded-lg border p-4 text-sm"
          >
            <p>
              You return to <strong>{redirectHosts(request).join(", ")}</strong> afterwards.
            </p>
            <p className="text-muted-foreground">{warningCopy.unverifiedName(origin)}</p>
            <ul className="flex flex-col gap-1">
              {request.requested.map((name) => (
                <li key={name}>
                  <strong>{name}</strong>: {permissions[name].summary.toLowerCase()}
                  {request.alreadyGranted.includes(name)
                    ? " (already granted)"
                    : stepUp && " (new)"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <SignedInAs className="text-center" onSwitch={switchAccount} />
      <OutcomePanel outcome={outcome} onReset={reset} />
    </div>
  );
}
