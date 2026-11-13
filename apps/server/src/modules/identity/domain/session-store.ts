import { Context, type DateTime, type Effect, type Option } from "effect";

import type { Session } from "#/modules/identity/domain/session.ts";

export class SessionStore extends Context.Service<
  SessionStore,
  {
    save(session: Session): Effect.Effect<void>;
    /** Does nothing when no Session has it: an extension never brings back a Session removed since it was read. */
    extend(tokenHash: string, expiresAt: DateTime.Utc): Effect.Effect<void>;
    findByTokenHash(tokenHash: string): Effect.Effect<Option.Option<Session>>;
    /** Idempotent. */
    remove(tokenHash: string): Effect.Effect<void>;
  }
>()("@quack/server/identity/SessionStore") {}
