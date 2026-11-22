import { Effect, Schema } from "effect";

export const variants = ["A", "B", "C"] as const;
export const scenarios = ["claude", "localhost", "step-up"] as const;

export type Variant = (typeof variants)[number];
export type Scenario = (typeof scenarios)[number];

// A value that is not one of the literals falls back to the default, since anyone can write the link.
export const ConsentSearch = Schema.Struct({
  variant: Schema.optional(
    Schema.Literals(variants).pipe(Schema.catchDecoding(() => Effect.succeedNone)),
  ),
  scenario: Schema.optional(
    Schema.Literals(scenarios).pipe(Schema.catchDecoding(() => Effect.succeedNone)),
  ),
});
