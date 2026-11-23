import type { Permission } from "@quack/contracts/permission";
import { setup, types } from "xstate/fsm";

import { toggled } from "#/lib/toggled.ts";

type Context = { readonly ticked: ReadonlySet<Permission> };

// Shared by `asking` and `failed`: it changes the ticks only, with no target to hide from the table.
const toggle = ({
  context,
  event,
}: {
  context: Context;
  event: { readonly permission: Permission; readonly on: boolean };
}) => ({ context: { ticked: toggled(context.ticked, event.permission, event.on) } });

/**
 * The Current User's answer to an AI Client: they tick its Permissions, then approve or deny, once; a failure lets them
 * answer again. Once the answer is sent, they leave for the AI Client. Approving nothing would give no Permission, so
 * it needs one ticked; denying always may.
 */
export const consentMachine = (ticked: ReadonlySet<Permission>) =>
  setup({
    schemas: {
      context: types<Context>(),
      events: {
        toggle: types<{ permission: Permission; on: boolean }>(),
        approve: types<{}>(),
        deny: types<{}>(),
        succeeded: types<{}>(),
        failed: types<{}>(),
      },
    },
  }).createFSM({
    initial: "asking",
    context: { ticked },
    states: {
      asking: {
        on: {
          toggle,
          approve: ({ context }) => (context.ticked.size > 0 ? { target: "answering" } : undefined),
          deny: { target: "answering" },
        },
      },
      answering: {
        on: { succeeded: { target: "leaving" }, failed: { target: "failed" } },
      },
      failed: {
        on: {
          toggle,
          approve: ({ context }) => (context.ticked.size > 0 ? { target: "answering" } : undefined),
          deny: { target: "answering" },
        },
      },
      leaving: {},
    },
  });
