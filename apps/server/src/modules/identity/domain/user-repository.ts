import type { EmailAlreadyTaken } from "@quack/contracts/identity/identity-errors";
import type { Email, User, UserId } from "@quack/contracts/identity/user";
import type { Paginated } from "@quack/contracts/pagination/paginated";
import type { UserListQuery } from "@quack/contracts/users/users-api";
import { Context, type Effect, type Option } from "effect";

export class UserRepository extends Context.Service<
  UserRepository,
  {
    readonly nextId: Effect.Effect<UserId>;
    create(user: User, passwordHash: string): Effect.Effect<void, EmailAlreadyTaken>;
    update(user: User): Effect.Effect<void>;
    setPasswordHash(id: UserId, passwordHash: string): Effect.Effect<void>;
    setEmail(id: UserId, email: Email): Effect.Effect<void, EmailAlreadyTaken>;
    /** Says whether there was a User to remove. */
    remove(id: UserId): Effect.Effect<boolean>;
    findById(id: UserId): Effect.Effect<Option.Option<User>>;
    findByEmail(
      email: Email,
    ): Effect.Effect<Option.Option<{ readonly user: User; readonly passwordHash: string }>>;
    findAll(query: UserListQuery): Effect.Effect<Paginated<User>>;
  }
>()("@quack/server/identity/UserRepository") {}
