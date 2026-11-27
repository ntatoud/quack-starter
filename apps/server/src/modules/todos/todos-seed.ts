import { createHash } from "node:crypto";

import type { UserId } from "@quack/contracts/identity/user";
import { Todo, TodoId, TodoTitle } from "@quack/contracts/todos/todo";
import { DateTime, Effect, Layer } from "effect";

import { seedDate } from "#/database/seed-date.ts";
import { Todos } from "#/modules/todos/todos.ts";

const drafts = [
  { title: "Read the README", completed: true },
  { title: "Start Postgres with pnpm dev", completed: true },
  { title: "Add a module, copied from todos", completed: false },
  { title: "Rebrand the app in @quack/brand", completed: false },
  { title: "Deploy the app", completed: false },
] as const;

// A hash of the owner and the place of the draft, laid out as a UUID v5, so that an owner's
// Todos keep their ids whatever other owners are seeded, and in whatever order.
const seededId = (ownerId: UserId, index: number): TodoId => {
  const hex = createHash("sha1").update(`${ownerId}/${index}`).digest("hex");
  const variant = ((Number.parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);

  return TodoId.make(
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
  );
};

const devTodos = (owners: ReadonlyArray<UserId>): ReadonlyArray<Todo> =>
  owners.flatMap((ownerId) =>
    drafts.map(
      ({ title, completed }, index) =>
        new Todo({
          id: seededId(ownerId, index),
          ownerId,
          title: TodoTitle.make(title),
          completed,
          createdAt: DateTime.subtract(DateTime.fromDateUnsafe(seedDate), {
            days: drafts.length - index,
          }),
        }),
    ),
  );

export const TodosSeed = (owners: ReadonlyArray<UserId>) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const seeded = devTodos(owners);
      yield* (yield* Todos).insert(seeded);
      yield* Effect.logInfo(`Seeded ${seeded.length} Todos`);
    }),
  ).pipe(Layer.provide(Todos.layer));
