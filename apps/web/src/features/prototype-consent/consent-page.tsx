import { useNavigate, useSearch } from "@tanstack/react-router";

import { PrototypeSwitcher } from "#/components/prototype-switcher.tsx";
import {
  type Scenario,
  type Variant,
  scenarios,
  variants,
} from "#/features/prototype-consent/consent-search.ts";
import { requests } from "#/features/prototype-consent/consent-stub.ts";
import { ConsentVariantA } from "#/features/prototype-consent/consent-variant-a.tsx";
import { ConsentVariantB } from "#/features/prototype-consent/consent-variant-b.tsx";
import { ConsentVariantC } from "#/features/prototype-consent/consent-variant-c.tsx";

const labels: Record<Variant, string> = { A: "Centred card", B: "Two columns", C: "One sentence" };

export function ConsentPage() {
  const search = useSearch({ from: "/prototype/consent" });
  const navigate = useNavigate();
  const variant = search.variant ?? "A";
  const scenario = search.scenario ?? "claude";
  const request = requests[scenario];

  return (
    <main className="min-h-svh bg-background px-4 py-10 pb-28">
      {/* Keyed so that the state of a variant (ticks, panel) starts again with a scenario. */}
      {variant === "A" && <ConsentVariantA key={scenario} request={request} />}
      {variant === "B" && <ConsentVariantB key={scenario} request={request} />}
      {variant === "C" && <ConsentVariantC key={scenario} request={request} />}
      <PrototypeSwitcher
        variants={variants.map((id) => ({ id, label: labels[id] }))}
        scenarios={scenarios}
        variant={variant}
        scenario={scenario}
        onChange={(next) =>
          navigate({
            to: "/prototype/consent",
            search: { variant: next.variant as Variant, scenario: next.scenario as Scenario },
            replace: true,
          })
        }
      />
    </main>
  );
}
