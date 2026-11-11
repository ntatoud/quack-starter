import { Config, Duration } from "effect";

/** How many attempts a counter of the `AttemptLimiter` takes in one window. The names are the variables to set. */
const attemptLimit = (name: string, limit: number, window: Duration.Duration) =>
  Config.all({
    limit: Config.Int(name).pipe(Config.withDefault(limit)),
    window: Config.Duration(`${name}_WINDOW`).pipe(Config.withDefault(window)),
  });

export const ServerConfig = Config.all({
  port: Config.Port("PORT").pipe(Config.withDefault(3001)),
  /**
   * Whether the session cookie is `Secure`: the browser sends it over https only.
   * True unless set otherwise. A browser keeps no `Secure` cookie of an origin served over http, localhost aside.
   */
  cookieSecure: Config.Boolean("COOKIE_SECURE").pipe(Config.withDefault(true)),
  /**
   * What the `AttemptLimiter` allows before it refuses with `TooManyAttempts`, until the window ends.
   * A window is a duration as `Duration` reads one: `15 minutes`, `1 hour`.
   */
  attemptLimits: Config.all({
    /** Sign-ins that failed on one email: 5 in 15 minutes. */
    signInFailuresPerEmail: attemptLimit("SIGN_IN_FAILURES_PER_EMAIL", 5, Duration.minutes(15)),
    /** Sign-ins that failed from one address, whatever the email: 20 in 15 minutes. */
    signInFailuresPerIp: attemptLimit("SIGN_IN_FAILURES_PER_IP", 20, Duration.minutes(15)),
    /** Sign-ups from one address: 10 in one hour. */
    signUpsPerIp: attemptLimit("SIGN_UPS_PER_IP", 10, Duration.hours(1)),
  }),
});
