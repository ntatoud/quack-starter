import type { EmailAlreadyTaken } from "@quack/contracts/identity/identity-errors";
import type { Email, User, UserId } from "@quack/contracts/identity/user";
import type { Paginated, PaginationQuery } from "@quack/contracts/pagination/paginated";
import { Context, type Effect, type Option } from "effect";

export class UserRepository extends Context.Service<
  UserRepository,
  {
    readonly nextId: Effect.Effect<UserId>;
    /** Checks the email and writes in one step, so two sign-ups with one email cannot both pass. */
    create(user: User, passwordHash: string): Effect.Effect<void, EmailAlreadyTaken>;
    findById(id: UserId): Effect.Effect<Option.Option<User>>;
    findByEmail(
      email: Email,
    ): Effect.Effect<Option.Option<{ readonly user: User; readonly passwordHash: string }>>;
    /** Sorted by email. */
    findAll(query: PaginationQuery): Effect.Effect<Paginated<User>>;
  }
>()("@quack/server/identity/UserRepository") {}
