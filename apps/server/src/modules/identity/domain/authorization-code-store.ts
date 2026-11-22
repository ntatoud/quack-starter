import { Context, type Effect, type Option } from "effect";

import type { AuthorizationCode } from "#/modules/identity/domain/authorization-code.ts";

export class AuthorizationCodeStore extends Context.Service<
  AuthorizationCodeStore,
  {
    save(code: AuthorizationCode): Effect.Effect<void>;
    /**
     * Removes the code as it finds it, so a code is redeemed once, even by two requests at once. Gives back an
     * expired code as well: its redeemer judges expiry.
     */
    take(codeHash: string): Effect.Effect<Option.Option<AuthorizationCode>>;
  }
>()("@quack/server/identity/AuthorizationCodeStore") {}
