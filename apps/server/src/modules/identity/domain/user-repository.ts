import type { EmailAlreadyTaken } from "@quack/contracts/identity/identity-errors";
import type { User, UserId } from "@quack/contracts/identity/user";
import { Context, type Effect, type Option } from "effect";

/** Port. The domain owns the interface; infrastructure provides the Layer. */
export class UserRepository extends Context.Service<
  UserRepository,
  {
    readonly nextId: Effect.Effect<UserId>;
    /**
     * Stores a new User with their password hash.
     * An email belongs to one User: the check and the write are one step, so two sign-ups cannot both pass.
     */
    create(user: User, passwordHash: string): Effect.Effect<void, EmailAlreadyTaken>;
    findById(id: UserId): Effect.Effect<Option.Option<User>>;
  }
>()("@quack/server/identity/UserRepository") {}
