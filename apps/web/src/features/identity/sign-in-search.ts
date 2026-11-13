import { Effect, Schema } from "effect";

// A `redirect` that is not a string is dropped, not refused with an error page: anyone can write the link.
export const SignInSearch = Schema.Struct({
  redirect: Schema.optional(Schema.String.pipe(Schema.catchDecoding(() => Effect.succeedNone))),
});
