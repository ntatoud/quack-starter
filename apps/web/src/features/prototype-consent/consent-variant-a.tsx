import { Badge } from "@quack/ui/components/badge";
import { Button } from "@quack/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@quack/ui/components/card";
import { Checkbox } from "@quack/ui/components/checkbox";
import { useState } from "react";

import { Callout } from "#/features/prototype-consent/consent-callouts.tsx";
import { OutcomePanel, useConsentOutcome } from "#/features/prototype-consent/consent-outcome.tsx";
import { SignedInAs } from "#/features/prototype-consent/consent-signed-in-as.tsx";
import {
  type ConsentRequest,
  type PermissionName,
  allLoopback,
  hostOf,
  newPermissions,
  permissions,
  redirectHosts,
  warningCopy,
} from "#/features/prototype-consent/consent-stub.ts";

/** Classic centred card: the User can untick Permissions. */
export function ConsentVariantA({ request }: { request: ConsentRequest }) {
  const { outcome, approve, deny, switchAccount, reset } = useConsentOutcome(request);
  const origin = hostOf(request.clientId);
  const [ticked, setTicked] = useState<PermissionName[]>(request.requested);
  const toggle = (name: PermissionName, on: boolean) =>
    setTicked((current) => (on ? [...current, name] : current.filter((n) => n !== name)));
  const chosenNew = newPermissions(request).filter((n) => ticked.includes(n));

  return (
    <div className="mx-auto w-full max-w-md">
      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-xl font-semibold tracking-tight">
            <h1>{origin} wants access to your todos</h1>
          </CardTitle>
          <CardDescription>
            Calls itself “{request.clientName}” (unverified). After you answer, you go back to{" "}
            <strong>{redirectHosts(request).join(", ")}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {allLoopback(request) && (
            <Callout tone="warning" title="Runs on this machine">
              {warningCopy.loopback}
            </Callout>
          )}
          <fieldset className="flex flex-col divide-y rounded-lg border">
            <legend className="sr-only">Permissions</legend>
            {request.requested.map((name) => {
              const granted = request.alreadyGranted.includes(name);
              return (
                <label key={name} className="flex cursor-pointer items-start gap-3 p-3">
                  <Checkbox
                    className="mt-0.5"
                    checked={granted || ticked.includes(name)}
                    disabled={granted}
                    onCheckedChange={(on) => toggle(name, on === true)}
                  />
                  <span className="flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {permissions[name].summary}
                      {granted ? (
                        <Badge variant="secondary">Already granted</Badge>
                      ) : (
                        request.alreadyGranted.length > 0 && <Badge>New</Badge>
                      )}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {permissions[name].detail}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={deny}>
              Deny
            </Button>
            <Button
              className="flex-1"
              disabled={chosenNew.length === 0}
              onClick={() => approve([...request.alreadyGranted, ...chosenNew])}
            >
              Approve
            </Button>
          </div>
          <SignedInAs onSwitch={switchAccount} />
        </CardContent>
      </Card>
      <OutcomePanel outcome={outcome} onReset={reset} />
    </div>
  );
}
