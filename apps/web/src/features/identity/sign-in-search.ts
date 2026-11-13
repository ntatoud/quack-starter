import { Effect, Schema } from "effect";

/**
 * The search of the sign-in page. `redirect` is the page to come back to once signed in.
 * Anyone can write it in a link, so a value that is not a string is dropped, not refused with an error page,
 * and the string is read through `redirectTarget` only.
 */
export const SignInSearch = Schema.Struct({
  redirect: Schema.optional(Schema.String.pipe(Schema.catchDecoding(() => Effect.succeedNone))),
});
