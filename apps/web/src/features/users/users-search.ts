import { Effect, Option, Schema } from "effect";

// A `page` that is not a page number leads to the first page, not to an error page: anyone can write the link.
// It is replaced, not dropped: the router keeps the raw value of a key that validation drops.
export const UsersSearch = Schema.Struct({
  page: Schema.optional(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)).pipe(
      Schema.catchDecoding(() => Effect.succeed(Option.some(1))),
    ),
  ),
});
