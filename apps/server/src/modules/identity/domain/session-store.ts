import { Context, type Effect, type Option } from "effect";

import type { Session } from "#/modules/identity/domain/session.ts";

/** Port. Sessions are found by the hash of their token, the only form the server keeps. */
export class SessionStore extends Context.Service<
  SessionStore,
  {
    save(session: Session): Effect.Effect<void>;
    findByTokenHash(tokenHash: string): Effect.Effect<Option.Option<Session>>;
  }
>()("@quack/server/identity/SessionStore") {}
