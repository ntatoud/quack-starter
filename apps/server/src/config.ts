import { Config, Duration, Schema } from "effect";

const attemptLimit = (name: string, limit: number, window: Duration.Duration) =>
  Config.all({
    limit: Config.schema(Schema.Int.check(Schema.isGreaterThan(0)), name).pipe(
      Config.withDefault(limit),
    ),
    window: Config.Duration(`${name}_WINDOW`).pipe(Config.withDefault(window)),
  });

// A record of Configs, not one: each reader reads only its own variables, so a test provides only those.
export const ServerConfig = {
  port: Config.Port("PORT").pipe(Config.withDefault(3001)),
  // The origin AI Clients reach Quack at, the web app's: the OAuth issuer and the MCP resource are named
  // from it, never from `Host`, which the client chooses.
  publicOrigin: Config.URL("PUBLIC_URL").pipe(Config.map((url) => url.origin)),
  // A loopback address is otherwise refused, so a request cannot make Quack reach a service on its own machine.
  allowLoopbackHttpAiClients: Config.Boolean("AI_CLIENT_LOOPBACK_HTTP").pipe(
    Config.withDefault(false),
  ),
  cookieSecure: Config.Boolean("COOKIE_SECURE").pipe(Config.withDefault(true)),
  attemptLimits: Config.all({
    signInFailuresPerEmail: attemptLimit("SIGN_IN_FAILURES_PER_EMAIL", 5, Duration.minutes(15)),
    signInFailuresPerIp: attemptLimit("SIGN_IN_FAILURES_PER_IP", 20, Duration.minutes(15)),
    signUpsPerIp: attemptLimit("SIGN_UPS_PER_IP", 10, Duration.hours(1)),
  }),
};

export const DatabaseConfig = Config.all({
  url: Config.Redacted("DATABASE_URL"),
  maxConnections: Config.schema(
    Schema.Int.check(Schema.isGreaterThan(0)),
    "DATABASE_MAX_CONNECTIONS",
  ).pipe(Config.withDefault(10)),
});

export type DatabaseSettings = Config.Success<typeof DatabaseConfig>;
