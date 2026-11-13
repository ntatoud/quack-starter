import { Effect, Schema } from "effect";

const ServerEnv = Schema.Struct({
  API_URL: Schema.URLFromString.pipe(
    Schema.withDecodingDefault(Effect.succeed("http://localhost:3001")),
  ),
});

export const serverEnv = Schema.decodeSync(ServerEnv)(process.env);
