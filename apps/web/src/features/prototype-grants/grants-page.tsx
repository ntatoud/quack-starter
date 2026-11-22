import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { PrototypeSwitcher } from "#/components/prototype-switcher.tsx";
import { makeGrants, type Scenario, scenarios } from "#/features/prototype-grants/grants-data.ts";
import { VariantA } from "#/features/prototype-grants/variant-a.tsx";
import { VariantB } from "#/features/prototype-grants/variant-b.tsx";
import { VariantC } from "#/features/prototype-grants/variant-c.tsx";

const route = getRouteApi("/_authenticated/app/settings/ai-clients");

const variants = [
  { id: "A", label: "Table" },
  { id: "B", label: "Cards" },
  { id: "C", label: "Grouped" },
];

/** Throwaway prototype: Grants are stubbed in memory and Revoke resets on reload. */
export function GrantsPage() {
  const { variant = "A", scenario = "several" } = route.useSearch();
  const navigate = useNavigate();
  const [state, setState] = useState(() => ({ scenario, grants: makeGrants(scenario) }));

  let grants = state.grants;
  if (state.scenario !== scenario) {
    grants = makeGrants(scenario);
    setState({ scenario, grants });
  }
  const revoke = (id: string) =>
    setState({ scenario, grants: grants.filter((grant) => grant.id !== id) });
  const revokeAll = () => setState({ scenario, grants: [] });

  return (
    <>
      <p className="text-sm text-muted-foreground">
        AI Clients you let act for you. Revoking one cuts it off at once.
      </p>
      {variant === "A" ? <VariantA grants={grants} onRevoke={revoke} /> : null}
      {variant === "B" ? (
        <VariantB grants={grants} onRevoke={revoke} onRevokeAll={revokeAll} />
      ) : null}
      {variant === "C" ? <VariantC grants={grants} onRevoke={revoke} /> : null}
      <PrototypeSwitcher
        variants={variants}
        scenarios={scenarios}
        variant={variant}
        scenario={scenario}
        onChange={(next) =>
          void navigate({
            to: "/app/settings/ai-clients",
            search: {
              variant: next.variant as "A" | "B" | "C",
              scenario: next.scenario as Scenario,
            },
            replace: true,
          })
        }
      />
    </>
  );
}
