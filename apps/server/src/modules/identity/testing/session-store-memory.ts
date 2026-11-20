import { Effect, Layer, Option } from "effect";

import type { Session } from "#/modules/identity/domain/session.ts";
import { SessionStore } from "#/modules/identity/domain/session-store.ts";

export const SessionStoreMemory = Layer.sync(SessionStore, () => {
  const sessions = new Map<string, Session>();

  return SessionStore.of({
    save: (session) => Effect.sync(() => void sessions.set(session.tokenHash, session)),
    extend: (tokenHash, expiresAt) =>
      Effect.sync(() => {
        const session = sessions.get(tokenHash);
        if (session !== undefined) {
          sessions.set(tokenHash, { ...session, expiresAt });
        }
      }),
    findByTokenHash: (tokenHash) =>
      Effect.sync(() => Option.fromNullishOr(sessions.get(tokenHash))),
    remove: (tokenHash) => Effect.sync(() => void sessions.delete(tokenHash)),
  });
});
