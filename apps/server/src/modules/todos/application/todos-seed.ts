import { base, en, Faker } from "@faker-js/faker";
import type { UserId } from "@quack/contracts/identity/user";
import { Todo, TodoId, TodoTitle } from "@quack/contracts/todos/todo";
import { DateTime, Effect, Layer } from "effect";

import { TodoRepository } from "#/modules/todos/domain/todo-repository.ts";

/** Every seeded Todo is created before it, so a seed gives the same Todos whatever day it runs. */
const seedDate = DateTime.makeUnsafe("2026-06-01T00:00:00Z");

const seededTodos = [
  { title: "Read the README", completed: true },
  { title: "Start Postgres with pnpm dev", completed: true },
  { title: "Add a module, copied from todos", completed: false },
  { title: "Rebrand the app in @quack/brand", completed: false },
  { title: "Deploy the app", completed: false },
] as const;

const devTodos = (owners: ReadonlyArray<UserId>): ReadonlyArray<Todo> => {
  const faker = new Faker({ locale: [en, base] });
  // Not identity's faker seed, whose first draws are the ids of the dev accounts.
  faker.seed(2);
  return owners.flatMap((ownerId) =>
    seededTodos.map(
      ({ title, completed }, index) =>
        new Todo({
          id: TodoId.make(faker.string.uuid()),
          ownerId,
          title: TodoTitle.make(title),
          completed,
          createdAt: DateTime.subtract(seedDate, { days: seededTodos.length - index }),
        }),
    ),
  );
};

export const TodosSeed = (owners: ReadonlyArray<UserId>) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const repository = yield* TodoRepository;
      const seeded = devTodos(owners);
      yield* Effect.forEach(seeded, repository.save, { discard: true });
      yield* Effect.logInfo(`Seeded ${seeded.length} Todos`);
    }),
  );
