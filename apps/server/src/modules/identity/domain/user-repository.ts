import type { EmailAlreadyTaken } from "@quack/contracts/identity/identity-errors";
import type { Email, User, UserId } from "@quack/contracts/identity/user";
import type { Paginated } from "@quack/contracts/pagination/paginated";
import type { UserListQuery } from "@quack/contracts/users/users-api";
import { Context, type Effect, type Option } from "effect";

export class UserRepository extends Context.Service<
  UserRepository,
  {
    readonly nextId: Effect.Effect<UserId>;
    /** Checks the email and writes in one step, so two sign-ups with one email cannot both pass. */
    create(user: User, passwordHash: string): Effect.Effect<void, EmailAlreadyTaken>;
    /** Keeps the email and the password hash the User was created with. */
    update(user: User): Effect.Effect<void>;
    findById(id: UserId): Effect.Effect<Option.Option<User>>;
    findByEmail(
      email: Email,
    ): Effect.Effect<Option.Option<{ readonly user: User; readonly passwordHash: string }>>;
    /**
     * Keeps the Users whose email or full name contains `search`, and whose status, Role, and team are those the
     * query asks for. Those that tie on `orderBy` are sorted by email, ascending, so a page is the same from one
     * request to the next.
     */
    findAll(query: UserListQuery): Effect.Effect<Paginated<User>>;
  }
>()("@quack/server/identity/UserRepository") {}
