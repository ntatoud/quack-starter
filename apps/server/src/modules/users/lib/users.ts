import { EmailAlreadyTaken, Unauthenticated } from "@quack/contracts/identity/identity-errors";
import { Profile } from "@quack/contracts/identity/profile";
import {
  type Email,
  type Password,
  type Role,
  type TimeZone,
  User,
  UserId,
} from "@quack/contracts/identity/user";
import {
  CannotChangeOwnAccess,
  CannotDeleteSelf,
  UserInvited,
  UserNotFound,
} from "@quack/contracts/users/user-errors";
import {
  type OnboardingPayload,
  type UserChanges,
  UserList,
  type UserListQuery,
} from "@quack/contracts/users/users-api";
import { Context, DateTime, Effect, Layer, Option } from "effect";

import { hashPassword, isPasswordOf } from "#/modules/users/lib/password.ts";
import { userQueries } from "#/modules/users/lib/user-queries.ts";
import { statusSetByAdmin } from "#/modules/users/lib/user-status.ts";

// Logged: a User refused for their Status answers as an unknown one, so the log is what tells the two apart.
const whileActive = (user: User) =>
  user.status === "active"
    ? Effect.succeedSome(user)
    : Effect.logInfo(`Refused a User ${user.status}`).pipe(
        Effect.annotateLogs({ userId: user.id }),
        Effect.as(Option.none<User>()),
      );

/** Sets the name of the Profile, creating it when the User has none. A second onboarding keeps the first date. */
const onboarded = (user: User, name: OnboardingPayload, at: DateTime.Utc): User =>
  new User({
    ...user,
    onboardedAt: user.onboardedAt ?? at,
    profile: new Profile({
      avatarUrl: null,
      jobTitle: "",
      team: null,
      country: null,
      ...user.profile,
      ...name,
    }),
  });

type UserKey = { readonly id: UserId } | { readonly email: Email };

export class Users extends Context.Service<
  Users,
  {
    /** A new `active` user, signed in as they sign up. */
    register(
      email: Email,
      password: Password,
      timeZone: TimeZone,
    ): Effect.Effect<User, EmailAlreadyTaken>;
    /**
     * The User whose password it is, while they may sign in. As slow for an email no User has: a fast answer would
     * tell that no User has it.
     */
    verifyPassword(email: Email, password: Password): Effect.Effect<Option.Option<User>>;
    /** As `verifyPassword`, and records the sign-in of the User it finds. */
    signIn(email: Email, password: Password): Effect.Effect<Option.Option<User>>;
    /** A User no longer `active` is found no more. */
    find(key: UserKey): Effect.Effect<Option.Option<User>>;
    /** Whether a User of any Status has the email. */
    isEmailTaken(email: Email): Effect.Effect<boolean>;
    changePassword(id: UserId, password: Password): Effect.Effect<void>;
    changeEmail(id: UserId, email: Email): Effect.Effect<void, EmailAlreadyTaken>;
    /** No endpoint makes the first Admin: the seed does, with this. */
    grantRole(id: UserId, role: Role): Effect.Effect<void>;
    list(query: UserListQuery): Effect.Effect<UserList>;
    get(id: UserId): Effect.Effect<User, UserNotFound>;
    /** `by` is the Admin who asks. */
    update(
      id: UserId,
      changes: UserChanges,
      by: UserId,
    ): Effect.Effect<User, UserNotFound | CannotChangeOwnAccess | UserInvited>;
    /** `by` is the Admin who asks. */
    remove(id: UserId, by: UserId): Effect.Effect<void, UserNotFound | CannotDeleteSelf>;
    updateProfile(id: UserId, profile: Profile): Effect.Effect<User, Unauthenticated>;
    updateTimeZone(id: UserId, timeZone: TimeZone): Effect.Effect<User, Unauthenticated>;
    completeOnboarding(id: UserId, name: OnboardingPayload): Effect.Effect<User, Unauthenticated>;
  }
>()("@quack/server/users/Users") {
  static readonly layer = Layer.effect(
    Users,
    Effect.gen(function* () {
      const queries = yield* userQueries;

      const verifyPassword = Effect.fn("Users.verifyPassword")(function* (
        email: Email,
        password: Password,
      ) {
        const found = yield* queries.findByEmail(email);

        if (Option.isNone(found)) {
          // The slow step of a check, done for nothing.
          yield* hashPassword(password);

          return Option.none<User>();
        }

        const { user, passwordHash } = found.value;

        // After the password: whoever does not know it must not learn the Status of the User.
        const matches = yield* isPasswordOf(password, passwordHash);

        return matches ? yield* whileActive(user) : Option.none<User>();
      });

      // Read again rather than taken from the Current User: the write must not bring back what changed since the
      // request was authenticated.
      const amendCurrentUser = Effect.fn("Users.amendCurrentUser")(function* (
        id: UserId,
        change: (user: User) => User,
      ) {
        const found = yield* queries.findById(id);

        if (Option.isNone(found)) {
          return yield* new Unauthenticated();
        }

        const user = change(found.value);
        yield* queries.update(user);

        return user;
      });

      return Users.of({
        register: Effect.fn("Users.register")(function* (email, password, timeZone) {
          const now = yield* DateTime.now;

          const user = new User({
            id: UserId.make(globalThis.crypto.randomUUID()),
            email,
            role: "user",
            status: "active",
            createdAt: now,
            lastSignInAt: now,
            onboardedAt: null,
            profile: null,
            timeZone,
          });

          yield* queries.create(user, yield* hashPassword(password));

          return user;
        }),
        verifyPassword,
        signIn: Effect.fn("Users.signIn")(function* (email, password) {
          const found = yield* verifyPassword(email, password);

          if (Option.isNone(found)) return found;

          const at = yield* DateTime.now;
          yield* queries.setLastSignInAt(found.value.id, at);

          return Option.some(new User({ ...found.value, lastSignInAt: at }));
        }),
        find: Effect.fn("Users.find")(function* (key) {
          const found =
            "email" in key
              ? Option.map(yield* queries.findByEmail(key.email), ({ user }) => user)
              : yield* queries.findById(key.id);

          return Option.isSome(found) ? yield* whileActive(found.value) : found;
        }),
        isEmailTaken: Effect.fn("Users.isEmailTaken")((email) =>
          Effect.map(queries.findByEmail(email), Option.isSome),
        ),
        changePassword: Effect.fn("Users.changePassword")(function* (id, password) {
          yield* queries.setPasswordHash(id, yield* hashPassword(password));
        }),
        changeEmail: Effect.fn("Users.changeEmail")(function* (id, email) {
          // Checked before it is set: a unique violation would abort the transaction the caller runs it in.
          if (Option.isSome(yield* queries.findByEmail(email))) {
            return yield* new EmailAlreadyTaken();
          }

          yield* queries.setEmail(id, email);
        }),
        grantRole: Effect.fn("Users.grantRole")((id, role) => queries.setRole(id, role)),
        list: Effect.fn("Users.list")(function* (query) {
          return new UserList(yield* queries.findAll(query));
        }),
        get: Effect.fn("Users.get")(function* (id) {
          const found = yield* queries.findById(id);

          if (Option.isNone(found)) {
            return yield* new UserNotFound({ id });
          }

          return found.value;
        }),
        update: Effect.fn("Users.update")(function* (id, changes, by) {
          if (id === by) return yield* new CannotChangeOwnAccess();
          const found = yield* queries.findById(id);

          if (Option.isNone(found)) return yield* new UserNotFound({ id });

          const withStatus =
            changes.status === undefined
              ? Option.some(found.value)
              : statusSetByAdmin(found.value, changes.status);

          if (Option.isNone(withStatus)) return yield* new UserInvited({ id });

          const user = new User({ ...withStatus.value, role: changes.role ?? found.value.role });
          yield* queries.update(user);

          return user;
        }),
        remove: Effect.fn("Users.remove")(function* (id, by) {
          if (id === by) return yield* new CannotDeleteSelf();
          const removed = yield* queries.remove(id);

          if (!removed) return yield* new UserNotFound({ id });
        }),
        updateProfile: Effect.fn("Users.updateProfile")((id, profile) =>
          amendCurrentUser(id, (user) => new User({ ...user, profile })),
        ),
        updateTimeZone: Effect.fn("Users.updateTimeZone")((id, timeZone) =>
          amendCurrentUser(id, (user) => new User({ ...user, timeZone })),
        ),
        completeOnboarding: Effect.fn("Users.completeOnboarding")(function* (id, name) {
          const now = yield* DateTime.now;

          return yield* amendCurrentUser(id, (user) => onboarded(user, name, now));
        }),
      });
    }),
  );
}
