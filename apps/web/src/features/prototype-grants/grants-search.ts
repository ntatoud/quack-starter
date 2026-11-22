import { Effect, Schema } from "effect";

const orDropped = <S extends Schema.Top>(schema: S) =>
  Schema.optional(schema.pipe(Schema.catchDecoding(() => Effect.succeedNone)));

export const GrantsSearch = Schema.Struct({
  variant: orDropped(Schema.Literals(["A", "B", "C"])),
  scenario: orDropped(Schema.Literals(["none", "one", "several"])),
});
