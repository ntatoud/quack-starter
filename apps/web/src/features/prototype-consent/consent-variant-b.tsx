import { Badge } from "@quack/ui/components/badge";
import { Button } from "@quack/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@quack/ui/components/card";
import { BadgeCheckIcon, CircleHelpIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Callout } from "#/features/prototype-consent/consent-callouts.tsx";
import { OutcomePanel, useConsentOutcome } from "#/features/prototype-consent/consent-outcome.tsx";
import { SignedInAs } from "#/features/prototype-consent/consent-signed-in-as.tsx";
import {
  type ConsentRequest,
  type Risk,
  allLoopback,
  hostOf,
  permissions,
  redirectHosts,
  riskTitles,
  warningCopy,
} from "#/features/prototype-consent/consent-stub.ts";

const risks: Risk[] = ["read", "change", "delete"];

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

/** Two columns: who is asking on the left, what for on the right. All or nothing. */
export function ConsentVariantB({ request }: { request: ConsentRequest }) {
  const { outcome, approve, deny, switchAccount, reset } = useConsentOutcome(request);
  const origin = hostOf(request.clientId);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Authorize an AI Client</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Who is asking</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="flex flex-col gap-4">
              <Fact label="Verified origin">
                <span className="flex items-center gap-2 text-lg font-semibold">
                  <BadgeCheckIcon aria-hidden className="size-5 text-emerald-600" />
                  {origin}
                </span>
              </Fact>
              <Fact label="Name it gives itself">
                <span className="flex items-center gap-2">
                  {request.clientName}
                  <Badge variant="outline">
                    <CircleHelpIcon aria-hidden data-icon="inline-start" />
                    Not verified
                  </Badge>
                </span>
              </Fact>
              <Fact label="You return to">{redirectHosts(request).join(", ")}</Fact>
            </dl>
            <Callout tone="info" title="Trust the origin, not the name">
              {warningCopy.unverifiedName(origin)}
            </Callout>
            {allLoopback(request) && (
              <Callout tone="warning" title="Runs on this machine">
                {warningCopy.loopback}
              </Callout>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>What it can do</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {risks.map((risk) => {
              const names = request.requested.filter((n) => permissions[n].risk === risk);
              if (names.length === 0) return null;
              return (
                <section key={risk}>
                  <h2
                    className={`text-xs font-semibold tracking-wide uppercase ${risk === "delete" ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {riskTitles[risk]}
                  </h2>
                  <ul className="mt-1 flex flex-col gap-2">
                    {names.map((name) => (
                      <li key={name} className="text-sm">
                        <span className="flex items-center gap-2 font-medium">
                          {permissions[name].summary}
                          {request.alreadyGranted.includes(name) ? (
                            <Badge variant="secondary">Already granted</Badge>
                          ) : (
                            request.alreadyGranted.length > 0 && <Badge>New</Badge>
                          )}
                        </span>
                        <span className="text-muted-foreground">{permissions[name].detail}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            <p className="text-xs text-muted-foreground">
              All or nothing: to give less, deny and ask the AI Client for fewer Permissions.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={deny}>
                Deny
              </Button>
              <Button className="flex-1" onClick={() => approve(request.requested)}>
                Approve
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <SignedInAs className="mt-4" onSwitch={switchAccount} />
      <OutcomePanel outcome={outcome} onReset={reset} />
    </div>
  );
}
