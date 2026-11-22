import { Effect, Schema } from "effect";

export const SortDirection = Schema.Literals(["asc", "desc"]);

export type SortDirection = typeof SortDirection.Type;

/** The fields of a query that sorts a list: `orderBy`, one of `fields`, and `dir`, ascending by default. */
export const sortingFields = <const Field extends string>(
  fields: readonly [Field, ...ReadonlyArray<Field>],
  defaultField: NoInfer<Field>,
) => ({
  orderBy: Schema.Literals(fields).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(defaultField)),
  ),
  dir: SortDirection.pipe(Schema.withDecodingDefaultKey(Effect.succeed<SortDirection>("asc"))),
});
