import type { UserId } from "@quack/contracts/identity/user";
import { Context, type DateTime, type Effect, type Option } from "effect";

import type { Session } from "#/modules/identity/domain/session.ts";

export class SessionStore extends Context.Service<
  SessionStore,
  {
    save(session: Session): Effect.Effect<void>;
    extend(tokenHash: string, expiresAt: DateTime.Utc): Effect.Effect<void>;
    findByTokenHash(tokenHash: string): Effect.Effect<Option.Option<Session>>;
    remove(tokenHash: string): Effect.Effect<void>;
    removeAllOf(userId: UserId): Effect.Effect<void>;
  }
>()("@quack/server/identity/SessionStore") {}
