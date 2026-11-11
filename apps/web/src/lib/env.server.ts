import { Effect, Schema } from "effect";

const ServerEnv = Schema.Struct({
  /** Origin of the API, which only the web server calls: the browser goes through the relay. */
  API_URL: Schema.String.pipe(Schema.withDecodingDefault(Effect.succeed("http://localhost:3001"))),
});

/**
 * Variables of the web server, never sent to the browser: they have no `VITE_` prefix.
 * Validated once at startup, so a bad value fails here and not at the first request.
 */
export const serverEnv = Schema.decodeSync(ServerEnv)(process.env);
