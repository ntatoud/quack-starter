import { Effect, Schema } from "effect";

// A `token` that is not a string is dropped, not refused with an error page: the page then says the link is expired.
export const ConfirmEmailSearch = Schema.Struct({
  token: Schema.optional(Schema.String.pipe(Schema.catchDecoding(() => Effect.succeedNone))),
});
