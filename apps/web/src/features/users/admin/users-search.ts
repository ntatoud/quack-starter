import { Effect, Schema } from "effect";

import { PageSearch } from "#/components/page-pagination.tsx";

// The router parses `?q=42` as a number: such a search is a search for nothing, not an invalid page.
export const UsersSearch = Schema.Struct({
  ...PageSearch.fields,
  q: Schema.optional(Schema.String.pipe(Schema.catchDecoding(() => Effect.succeedSome("")))),
});
