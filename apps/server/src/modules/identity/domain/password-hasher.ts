import type { Password } from "@quack/contracts/identity/user";
import { Context, type Effect } from "effect";

export class PasswordHasher extends Context.Service<
  PasswordHasher,
  {
    hash(password: Password): Effect.Effect<string>;
    /** A hash this adapter cannot read is `false`, not an error. */
    verify(password: Password, hash: string): Effect.Effect<boolean>;
  }
>()("@quack/server/identity/PasswordHasher") {}
