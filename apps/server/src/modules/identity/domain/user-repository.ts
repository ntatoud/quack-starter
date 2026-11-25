import type { EmailAlreadyTaken } from "@quack/contracts/identity/identity-errors";
import type { Email, User, UserId } from "@quack/contracts/identity/user";
import type { Paginated } from "@quack/contracts/pagination/paginated";
import type { UserListQuery } from "@quack/contracts/users/users-api";
import { Context, type Effect, type Option } from "effect";

export class UserRepository extends Context.Service<
  UserRepository,
  {
    readonly nextId: Effect.Effect<UserId>;
    /** A User with no password, who cannot sign in: a sign-up goes through `AppAuth.register`. */
    create(user: User): Effect.Effect<void, EmailAlreadyTaken>;
    update(user: User): Effect.Effect<void>;
    /** Says whether there was a User to remove. */
    remove(id: UserId): Effect.Effect<boolean>;
    findById(id: UserId): Effect.Effect<Option.Option<User>>;
    findByEmail(email: Email): Effect.Effect<Option.Option<User>>;
    findAll(query: UserListQuery): Effect.Effect<Paginated<User>>;
  }
>()("@quack/server/identity/UserRepository") {}
