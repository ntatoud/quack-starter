import { assert, describe, it } from "@effect/vitest";
import { CountryCode, Profile, type Team } from "@quack/contracts/identity/profile";
import { Email, type Role, User, UserId, type UserStatus } from "@quack/contracts/identity/user";
import type { UserListQuery } from "@quack/contracts/users/users-api";
import { Effect, type Layer, Option, Result } from "effect";

import { UserRepository } from "#/modules/identity/domain/user-repository.ts";
import { day, dayOrNull } from "#/modules/identity/testing/days.ts";

// An adapter that persists keeps the Users of the tests before, so each test marks its own and searches for the mark.
const aMark = Effect.sync(() => crypto.randomUUID().slice(0, 8));

interface UserFields {
  readonly role?: Role;
  readonly status?: UserStatus;
  readonly lastSignInOn?: number | null;
  readonly onboardedOn?: number | null;
  readonly profile?: {
    readonly firstName: string;
    readonly lastName: string;
    readonly team: Team | null;
    readonly country?: CountryCode | null;
  } | null;
}

const aUser = (
  mark: string,
  name: string,
  {
    role = "user",
    status = "active",
    lastSignInOn = null,
    onboardedOn = null,
    profile = null,
  }: UserFields = {},
) =>
  Effect.gen(function* () {
    const repository = yield* UserRepository;

    return new User({
      id: yield* repository.nextId,
      email: Email.make(`${name}.${mark}@example.com`),
      role,
      status,
      createdAt: day(1),
      lastSignInAt: dayOrNull(lastSignInOn),
      onboardedAt: dayOrNull(onboardedOn),
      profile:
        profile === null
          ? null
          : new Profile({
              country: CountryCode.make("FR"),
              ...profile,
              avatarUrl: null,
              jobTitle: "",
            }),
    });
  });

const created = (...users: ReadonlyArray<User>) =>
  Effect.gen(function* () {
    const repository = yield* UserRepository;
    yield* Effect.forEach(users, (user) =>
      repository.create(user, `hash of ${user.email}`).pipe(Effect.orDie),
    );
  });

const firstPage = { page: 1, pageSize: 20, orderBy: "email", dir: "asc" } as const;

const listed = (query: Partial<UserListQuery> & Pick<UserListQuery, "search">) =>
  Effect.gen(function* () {
    const repository = yield* UserRepository;
    const { items, total } = yield* repository.findAll({ ...firstPage, ...query });

    return { emails: items.map(({ email }) => email), total };
  });

const person = (firstName: string, lastName: string) =>
  ({ firstName, lastName, team: "design" }) as const;

const emailsOf = (...users: ReadonlyArray<User>) => users.map(({ email }) => email);

export const userRepositorySuite = (layer: Layer.Layer<UserRepository>) => {
  const test = (name: string, body: () => Effect.Effect<void, never, UserRepository>) =>
    it.effect(name, () => body().pipe(Effect.provide(layer)));

  describe("UserRepository", () => {
    test("finds a created User by id, and by email with their password hash", () =>
      Effect.gen(function* () {
        const repository = yield* UserRepository;
        const user = yield* aUser(yield* aMark, "ada");
        yield* created(user);

        assert.deepStrictEqual(yield* repository.findById(user.id), Option.some(user));
        assert.deepStrictEqual(
          yield* repository.findByEmail(user.email),
          Option.some({ user, passwordHash: `hash of ${user.email}` }),
        );
      }));

    test("finds no User for an unknown id or email", () =>
      Effect.gen(function* () {
        const repository = yield* UserRepository;
        const unknown = yield* aUser(yield* aMark, "nobody");

        assert.isTrue(Option.isNone(yield* repository.findById(unknown.id)));
        assert.isTrue(Option.isNone(yield* repository.findByEmail(unknown.email)));
      }));

    test("finds no User for an id it did not give", () =>
      Effect.gen(function* () {
        const repository = yield* UserRepository;

        assert.isTrue(Option.isNone(yield* repository.findById(UserId.make("not-an-id"))));
      }));

    test("gives a new id each time", () =>
      Effect.gen(function* () {
        const repository = yield* UserRepository;

        assert.notStrictEqual(yield* repository.nextId, yield* repository.nextId);
      }));

    test("checks the email in one step with the write: of two creates at once with one email, one fails EmailAlreadyTaken", () =>
      Effect.gen(function* () {
        const repository = yield* UserRepository;
        const mark = yield* aMark;
        const first = yield* aUser(mark, "ada");
        const second = new User({ ...(yield* aUser(mark, "grace")), email: first.email });

        const results = yield* Effect.forEach(
          [first, second],
          (user) => Effect.result(repository.create(user, "hash")),
          { concurrency: "unbounded" },
        );

        assert.deepStrictEqual(
          results
            .map((result) => (Result.isFailure(result) ? result.failure._tag : "created"))
            .toSorted(),
          ["EmailAlreadyTaken", "created"],
        );
        assert.strictEqual((yield* listed({ search: mark })).total, 1);
      }));

    test("removes a User and says so, and their email is free again", () =>
      Effect.gen(function* () {
        const repository = yield* UserRepository;
        const user = yield* aUser(yield* aMark, "ada");
        yield* created(user);

        assert.isTrue(yield* repository.remove(user.id));

        assert.isTrue(Option.isNone(yield* repository.findById(user.id)));
        assert.isTrue(Option.isNone(yield* repository.findByEmail(user.email)));
        yield* created(user);
      }));

    test("removes nothing for an id no User has, or one it did not give, and says so", () =>
      Effect.gen(function* () {
        const repository = yield* UserRepository;
        const unknown = yield* aUser(yield* aMark, "nobody");

        assert.isFalse(yield* repository.remove(unknown.id));
        assert.isFalse(yield* repository.remove(UserId.make("not-an-id")));
        assert.isTrue(Option.isNone(yield* repository.findById(UserId.make("not-an-id"))));
      }));

    test("replaces the password hash of a User, and keeps the others'", () =>
      Effect.gen(function* () {
        const repository = yield* UserRepository;
        const mark = yield* aMark;
        const [ada, grace] = [yield* aUser(mark, "ada"), yield* aUser(mark, "grace")];
        yield* created(ada, grace);

        yield* repository.setPasswordHash(ada.id, "new hash");

        assert.deepStrictEqual(
          yield* repository.findByEmail(ada.email),
          Option.some({ user: ada, passwordHash: "new hash" }),
        );
        assert.deepStrictEqual(
          yield* repository.findByEmail(grace.email),
          Option.some({ user: grace, passwordHash: `hash of ${grace.email}` }),
        );
      }));

    test("keeps the email and the password hash on update", () =>
      Effect.gen(function* () {
        const repository = yield* UserRepository;
        const mark = yield* aMark;
        const user = yield* aUser(mark, "ada");
        yield* created(user);

        const suspended = new User({
          ...user,
          status: "suspended",
          email: Email.make(`changed.${mark}@example.com`),
        });

        yield* repository.update(suspended);

        assert.deepStrictEqual(
          yield* repository.findByEmail(user.email),
          Option.some({
            user: new User({ ...suspended, email: user.email }),
            passwordHash: `hash of ${user.email}`,
          }),
        );
        assert.isTrue(Option.isNone(yield* repository.findByEmail(suspended.email)));
      }));

    test("lists the Users whose email or full name contains the search, whatever the case of the name", () =>
      Effect.gen(function* () {
        const mark = yield* aMark;
        const byEmail = yield* aUser(mark, `x${mark}y`);

        const byName = yield* aUser(mark, "grace", {
          profile: { firstName: "Grace", lastName: `Hop${mark.toUpperCase()}per`, team: "design" },
        });

        const neither = yield* aUser(mark, "linus", {
          profile: { firstName: "Linus", lastName: "Torvalds", team: "design" },
        });

        yield* created(byEmail, byName, neither);

        assert.deepStrictEqual((yield* listed({ search: `x${mark}y` })).emails, emailsOf(byEmail));
        assert.deepStrictEqual(
          (yield* listed({ search: `grace hop${mark}per` })).emails,
          emailsOf(byName),
        );
      }));

    test("lists the Users of the Role, the status, and the team asked", () =>
      Effect.gen(function* () {
        const mark = yield* aMark;
        const engineering = { firstName: "A", lastName: "B", team: "engineering" } as const;

        const kept = yield* aUser(mark, "kept", {
          role: "admin",
          status: "invited",
          profile: engineering,
        });

        const otherRole = yield* aUser(mark, "role", { status: "invited", profile: engineering });
        const otherStatus = yield* aUser(mark, "status", { role: "admin", profile: engineering });

        const otherTeam = yield* aUser(mark, "team", {
          role: "admin",
          status: "invited",
          profile: { ...engineering, team: "sales" },
        });

        const noProfile = yield* aUser(mark, "noprofile", { role: "admin", status: "invited" });
        yield* created(kept, otherRole, otherStatus, otherTeam, noProfile);

        assert.deepStrictEqual(
          (yield* listed({ search: mark, role: "admin", status: "invited", team: "engineering" }))
            .emails,
          emailsOf(kept),
        );
        assert.deepStrictEqual(
          (yield* listed({ search: mark, role: "user" })).emails,
          emailsOf(otherRole),
        );
        assert.deepStrictEqual(
          (yield* listed({ search: mark, status: "active" })).emails,
          emailsOf(otherStatus),
        );
        assert.deepStrictEqual(
          (yield* listed({ search: mark, team: "sales" })).emails,
          emailsOf(otherTeam),
        );
      }));

    test("sorts the Users with no value last in either direction, and ties by email, ascending", () =>
      Effect.gen(function* () {
        const mark = yield* aMark;
        const early = yield* aUser(mark, "early", { lastSignInOn: 1 });
        const lateB = yield* aUser(mark, "b-late", { lastSignInOn: 9 });
        const lateA = yield* aUser(mark, "a-late", { lastSignInOn: 9 });
        const neverD = yield* aUser(mark, "d-never");
        const neverC = yield* aUser(mark, "c-never");
        yield* created(neverD, lateB, early, neverC, lateA);

        assert.deepStrictEqual(
          (yield* listed({ search: mark, orderBy: "lastSignInAt", dir: "asc" })).emails,
          emailsOf(early, lateA, lateB, neverC, neverD),
        );
        assert.deepStrictEqual(
          (yield* listed({ search: mark, orderBy: "lastSignInAt", dir: "desc" })).emails,
          emailsOf(lateA, lateB, early, neverC, neverD),
        );
      }));

    test("sorts by the date of onboarding, the Users not yet onboarded last", () =>
      Effect.gen(function* () {
        const mark = yield* aMark;
        const early = yield* aUser(mark, "early", { onboardedOn: 2 });
        const late = yield* aUser(mark, "late", { onboardedOn: 8 });
        const notYet = yield* aUser(mark, "not-yet");
        yield* created(notYet, late, early);

        assert.deepStrictEqual(
          (yield* listed({ search: mark, orderBy: "onboardedAt", dir: "asc" })).emails,
          emailsOf(early, late, notYet),
        );
        assert.deepStrictEqual(
          (yield* listed({ search: mark, orderBy: "onboardedAt", dir: "desc" })).emails,
          emailsOf(late, early, notYet),
        );
      }));

    test("lists the Users onboarded, or those not yet", () =>
      Effect.gen(function* () {
        const mark = yield* aMark;
        const onboarded = yield* aUser(mark, "onboarded", { onboardedOn: 2 });
        const notYet = yield* aUser(mark, "not-yet");
        yield* created(onboarded, notYet);

        assert.deepStrictEqual(
          (yield* listed({ search: mark, onboarded: true })).emails,
          emailsOf(onboarded),
        );
        assert.deepStrictEqual(
          (yield* listed({ search: mark, onboarded: false })).emails,
          emailsOf(notYet),
        );
      }));

    test("keeps a Profile with no team and no country", () =>
      Effect.gen(function* () {
        const repository = yield* UserRepository;
        const mark = yield* aMark;

        const user = yield* aUser(mark, "ada", {
          profile: { firstName: "Ada", lastName: "Lovelace", team: null, country: null },
        });

        yield* created(user);

        assert.deepStrictEqual(yield* repository.findById(user.id), Option.some(user));
      }));

    test("sorts the Users with no team or no country last, in either direction", () =>
      Effect.gen(function* () {
        const mark = yield* aMark;

        const design = yield* aUser(mark, "a", {
          profile: { ...person("Ann", "A"), country: CountryCode.make("GB") },
        });

        const sales = yield* aUser(mark, "b", {
          profile: { ...person("Bob", "B"), team: "sales", country: CountryCode.make("FR") },
        });

        const neither = yield* aUser(mark, "c", {
          profile: { ...person("Cy", "C"), team: null, country: null },
        });

        yield* created(neither, sales, design);

        for (const orderBy of ["team", "country"] as const) {
          assert.deepStrictEqual(
            (yield* listed({ search: mark, orderBy, dir: "asc" })).emails,
            orderBy === "team"
              ? emailsOf(design, sales, neither)
              : emailsOf(sales, design, neither),
          );
          assert.deepStrictEqual(
            (yield* listed({ search: mark, orderBy, dir: "desc" })).emails,
            orderBy === "team"
              ? emailsOf(sales, design, neither)
              : emailsOf(design, sales, neither),
          );
        }
      }));

    test("sorts by Status in the alphabetical order of its names", () =>
      Effect.gen(function* () {
        const mark = yield* aMark;
        const suspended = yield* aUser(mark, "a", { status: "suspended" });
        const active = yield* aUser(mark, "b", { status: "active" });
        const invited = yield* aUser(mark, "c", { status: "invited" });
        yield* created(suspended, active, invited);

        assert.deepStrictEqual(
          (yield* listed({ search: mark, orderBy: "status" })).emails,
          emailsOf(active, invited, suspended),
        );
        assert.deepStrictEqual(
          (yield* listed({ search: mark, orderBy: "status", dir: "desc" })).emails,
          emailsOf(suspended, invited, active),
        );
      }));

    test("sorts by name, last name first, those with no Profile last in either direction", () =>
      Effect.gen(function* () {
        const mark = yield* aMark;
        const smithZoe = yield* aUser(mark, "a", { profile: person("Zoe", "Smith") });
        const smithAnn = yield* aUser(mark, "b", { profile: person("Ann", "Smith") });
        const smithson = yield* aUser(mark, "c", { profile: person("Abe", "Smithson") });
        const jones = yield* aUser(mark, "d", { profile: person("Zed", "Jones") });
        const noProfile = yield* aUser(mark, "e");
        yield* created(noProfile, smithson, smithZoe, jones, smithAnn);

        assert.deepStrictEqual(
          (yield* listed({ search: mark, orderBy: "name" })).emails,
          emailsOf(jones, smithAnn, smithZoe, smithson, noProfile),
        );
        assert.deepStrictEqual(
          (yield* listed({ search: mark, orderBy: "name", dir: "desc" })).emails,
          emailsOf(smithson, smithZoe, smithAnn, jones, noProfile),
        );
      }));

    test("pages the Users, with the total of every page", () =>
      Effect.gen(function* () {
        const mark = yield* aMark;
        const a = yield* aUser(mark, "a");
        const b = yield* aUser(mark, "b");
        const c = yield* aUser(mark, "c");
        const d = yield* aUser(mark, "d");
        const e = yield* aUser(mark, "e");
        yield* created(e, c, a, d, b);

        assert.deepStrictEqual(yield* listed({ search: mark, pageSize: 2, page: 2 }), {
          emails: emailsOf(c, d),
          total: 5,
        });
        assert.deepStrictEqual(yield* listed({ search: mark, pageSize: 2, page: 3 }), {
          emails: emailsOf(e),
          total: 5,
        });
        assert.deepStrictEqual(yield* listed({ search: mark, pageSize: 2, page: 4 }), {
          emails: [],
          total: 5,
        });
        assert.deepStrictEqual(
          (yield* listed({ search: mark, pageSize: 2 })).emails,
          emailsOf(a, b),
        );
      }));
  });
};
