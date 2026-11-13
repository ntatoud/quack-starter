import type { Password } from "@quack/contracts/identity/user";
import { Context, type Effect } from "effect";

/** Port. Passwords are stored hashed; the adapter chooses the algorithm and its stored format. */
export class PasswordHasher extends Context.Service<
  PasswordHasher,
  {
    /** The string to store: it carries what `verify` needs, the salt and the parameters included. */
    hash(password: Password): Effect.Effect<string>;
    /** Succeeds with `false` for a wrong password, and for a hash this adapter cannot read. */
    verify(password: Password, hash: string): Effect.Effect<boolean>;
  }
>()("@quack/server/identity/PasswordHasher") {}
