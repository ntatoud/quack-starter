import { Config, Duration, Schema } from "effect";

const attemptLimit = (name: string, limit: number, window: Duration.Duration) =>
  Config.all({
    limit: Config.schema(Schema.Int.check(Schema.isGreaterThan(0)), name).pipe(
      Config.withDefault(limit),
    ),
    window: Config.Duration(`${name}_WINDOW`).pipe(Config.withDefault(window)),
  });

export const ServerConfig = Config.all({
  port: Config.Port("PORT").pipe(Config.withDefault(3001)),
  cookieSecure: Config.Boolean("COOKIE_SECURE").pipe(Config.withDefault(true)),
  attemptLimits: Config.all({
    signInFailuresPerEmail: attemptLimit("SIGN_IN_FAILURES_PER_EMAIL", 5, Duration.minutes(15)),
    signInFailuresPerIp: attemptLimit("SIGN_IN_FAILURES_PER_IP", 20, Duration.minutes(15)),
    signUpsPerIp: attemptLimit("SIGN_UPS_PER_IP", 10, Duration.hours(1)),
  }),
});
