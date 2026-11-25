import type { Password, UserId } from "@quack/contracts/identity/user";
import { Context, type Effect } from "effect";

/** The password of a User, set outside a sign-up: Yielded Auth offers no reset Quack can use (`app-auth.ts`). */
export class PasswordCredentials extends Context.Service<
  PasswordCredentials,
  {
    /** Ends every Session of the User too. A User with no password keeps none. */
    replace(userId: UserId, password: Password): Effect.Effect<void>;
  }
>()("@quack/server/identity/PasswordCredentials") {}
