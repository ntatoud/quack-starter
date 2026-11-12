import { Config } from "effect";

export const ServerConfig = Config.all({
  port: Config.Port("PORT").pipe(Config.withDefault(3001)),
});
