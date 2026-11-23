import { grantablePermissions } from "@quack/contracts/grants/grant";
import type { Permission } from "@quack/contracts/permission";
import { setup, types } from "xstate/fsm";

import { toggled } from "#/lib/toggled.ts";

type Step = "editing" | "reviewing";

/** What confirming would change: `held` is what the Grant holds now. */
export const permissionsChange = (
  held: ReadonlyArray<Permission>,
  ticked: ReadonlySet<Permission>,
) => {
  const chosen = grantablePermissions.filter((permission) => ticked.has(permission));

  return {
    chosen,
    added: chosen.filter((permission) => !held.includes(permission)),
    removed: held.filter((permission) => !ticked.has(permission)),
  };
};

/** Never none, which revoking covers, and never the same as before, which would change nothing. */
const canReview = (held: ReadonlyArray<Permission>, ticked: ReadonlySet<Permission>) => {
  const { chosen, added, removed } = permissionsChange(held, ticked);

  return chosen.length > 0 && added.length + removed.length > 0;
};

/**
 * The dialog that edits the Permissions of a Grant: closed, then the User ticks them, then reviews the change before
 * confirming it. The request itself is the mutation's, not the machine's.
 */
export const editGrantMachine = setup({
  schemas: {
    context: types<{ ticked: ReadonlySet<Permission> }>(),
    events: {
      open: types<{ held: ReadonlyArray<Permission> }>(),
      toggle: types<{ permission: Permission; on: boolean }>(),
      review: types<{ held: ReadonlyArray<Permission> }>(),
      back: types<{}>(),
      close: types<{}>(),
    },
  },
  // A target must be declared here. `closedOn` belongs to `closed`: the context of the other states has none, so
  // the transition out of it has to clear it, since a patch keeps every field it does not set.
  states: {
    // The step it closed on stays on screen while the dialog fades out.
    closed: { schemas: { context: types<{ closedOn: Step }>() } },
    editing: { schemas: { context: types<{ closedOn?: undefined }>() } },
    reviewing: { schemas: { context: types<{ closedOn?: undefined }>() } },
  },
}).createFSM({
  initial: "closed",
  context: { ticked: new Set(), closedOn: "editing" },
  states: {
    closed: {
      on: {
        // Opens on what the Grant holds now, whatever was left unconfirmed before.
        open: ({ event }) => ({
          target: "editing",
          context: { ticked: new Set(event.held), closedOn: undefined },
        }),
      },
    },
    editing: {
      on: {
        toggle: ({ context, event }) => ({
          context: { ticked: toggled(context.ticked, event.permission, event.on) },
        }),
        review: ({ context, event }) =>
          canReview(event.held, context.ticked) ? { target: "reviewing" } : undefined,
        close: { target: "closed", context: { closedOn: "editing" } },
      },
    },
    reviewing: {
      on: {
        back: { target: "editing" },
        close: { target: "closed", context: { closedOn: "reviewing" } },
      },
    },
  },
});
