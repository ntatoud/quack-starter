import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { ConsentPage } from "#/features/prototype-consent/consent-page.tsx";
import { ConsentSearch } from "#/features/prototype-consent/consent-search.ts";

// Throwaway: not behind `_authenticated`, the User is faked.
export const Route = createFileRoute("/prototype/consent")({
  validateSearch: Schema.toStandardSchemaV1(ConsentSearch),
  component: ConsentPage,
});
