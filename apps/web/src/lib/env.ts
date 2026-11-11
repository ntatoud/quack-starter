import { Effect, Schema } from "effect";

const Env = Schema.Struct({
  VITE_API_URL: Schema.String.pipe(
    Schema.withDecodingDefault(Effect.succeed("http://localhost:3001")),
  ),
});

/** Validated once at startup, so a bad value fails here and not at the first request. */
export const env = Schema.decodeUnknownSync(Env)(import.meta.env);
