import { Config } from "effect";

export const ServerConfig = Config.all({
  port: Config.Port("PORT").pipe(Config.withDefault(3001)),
  /**
   * Whether the session cookie is `Secure`: the browser sends it over https only.
   * True unless set otherwise. A browser keeps no `Secure` cookie of an origin served over http, localhost aside.
   */
  cookieSecure: Config.Boolean("COOKIE_SECURE").pipe(Config.withDefault(true)),
});
