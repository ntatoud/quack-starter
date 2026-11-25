import { TimeZone, UserId } from "@quack/contracts/identity/user";
import { Auth, Password, Sessions } from "@yielded/auth";
import { Effect, Schema } from "effect";

import { sessionLifetime } from "#/modules/identity/domain/session.ts";

/**
 * What a sign-up gives the User row beyond the email. Never sent by a client: only the server calls `register`,
 * so the seed passes the ids it needs too.
 */
export const Registration = Schema.Struct({ id: UserId, timeZone: TimeZone });

/**
 * Yielded Auth holds the credentials and the Sessions of Users; the User, their Role and Status stay in identity.
 * The subject of a Session is the id of its User.
 */
export const AppAuth = Auth.make("quack/Auth", {
  // A Session carries no claims: the middleware reads the User from the database on every request.
  claims: Schema.Struct({}),
  sessions: Sessions.stateful({ maxAge: sessionLifetime, idleTimeout: sessionLifetime }),
  strategies: {
    password: Password.make({
      // Quack's `AttemptLimiter` limits sign-ins, with limits of the config and failures only. Yielded's own
      // counts every attempt, 10 a minute per email: it stays as a ceiling far above Quack's.
      policy: {
        ...Password.defaultPasswordMethodPolicy,
        attempts: {
          ...Password.defaultPasswordMethodPolicy.attempts,
          identifier: { limit: 1000, windowMillis: 60_000 },
          subject: { limit: 1000, windowMillis: 60_000 },
        },
      },
      registration: Registration,
      // Yielded's reset needs a verified email, which Quack never asks for: its own link resets the password.
      reset: Password.resetCode(),
    }),
  },
  defaultStrategy: "password",
});

/** For a trusted caller in the process, such as the seed: no request, no Session, nothing to admit before a write. */
export const localAuthRequest = Auth.AuthRequest.of({
  invocation: { _tag: "Guest" },
  credentials: {},
  credentialCommandSink: () => Effect.void,
});
