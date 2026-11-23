import { User } from "@quack/contracts/identity/user";
import type { UserChanges } from "@quack/contracts/users/users-api";
import { Option } from "effect";
import { setup, types } from "xstate/fsm";

/**
 * How the Status of a User moves. An Admin suspends an `active` User and lets a `suspended` one back in; setting
 * the Status a User already has changes nothing. An `invited` User leaves `invited` only by choosing a password:
 * an Admin has no event there.
 */
const userStatusMachine = setup({
  schemas: { events: { suspend: types<{}>(), reactivate: types<{}>() } },
}).createFSM({
  // A User is read at the Status the store holds, never started from here: this only satisfies `createFSM`.
  initial: "active",
  states: {
    active: {
      on: { suspend: { target: "suspended" }, reactivate: { target: "active" } },
    },
    suspended: {
      on: { reactivate: { target: "active" }, suspend: { target: "suspended" } },
    },
    invited: {},
  },
});

const eventOf = { active: "reactivate", suspended: "suspend" } as const;

/** The User at the Status an Admin set, or none when theirs is not the Admin's to change. */
export const statusSetByAdmin = (
  user: User,
  status: NonNullable<UserChanges["status"]>,
): Option.Option<User> => {
  const type = eventOf[status];

  // An FSM answers an event its state does not take with the same snapshot, as it answers one that changes
  // nothing, and has no `can`: only its table tells them apart.
  if (!Object.hasOwn(userStatusMachine.config.states[user.status].on ?? {}, type)) {
    return Option.none();
  }

  const [next] = userStatusMachine.transition(
    { ...userStatusMachine.initialState, value: user.status },
    { type },
  );

  return Option.some(new User({ ...user, status: next.value }));
};
