import { Config } from "effect";

export const ServerConfig = Config.all({
  port: Config.Port("PORT").pipe(Config.withDefault(3001)),
  webOrigin: Config.String("WEB_ORIGIN").pipe(Config.withDefault("http://localhost:3000")),
});
