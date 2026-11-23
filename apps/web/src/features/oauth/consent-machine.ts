import type { Permission } from "@quack/contracts/permission";
import { setup, types } from "xstate/fsm";

import { toggled } from "#/lib/toggled.ts";

type Answer = "approve" | "deny";

type Context = { readonly ticked: ReadonlySet<Permission> };

const toggle = ({
  context,
  event,
}: {
  context: Context;
  event: { readonly permission: Permission; readonly on: boolean };
}) => ({ context: { ticked: toggled(context.ticked, event.permission, event.on) } });

// Approving nothing would give no Permission; denying always may.
const answer = ({ context, event }: { context: Context; event: { readonly answer: Answer } }) =>
  event.answer === "deny" || context.ticked.size > 0 ? { target: "answering" as const } : undefined;

/**
 * The Current User's answer to an AI Client: they tick its Permissions, then approve or deny, once; a failure lets them
 * answer again. Once the answer is sent, they leave for the AI Client.
 */
export const consentMachine = (ticked: ReadonlySet<Permission>) =>
  setup({
    schemas: {
      context: types<Context>(),
      events: {
        toggle: types<{ permission: Permission; on: boolean }>(),
        answer: types<{ answer: Answer }>(),
        succeeded: types<{}>(),
        failed: types<{}>(),
      },
    },
  }).createFSM({
    initial: "asking",
    context: { ticked },
    states: {
      asking: { on: { toggle, answer } },
      answering: {
        on: { succeeded: { target: "leaving" }, failed: { target: "failed" } },
      },
      failed: { on: { toggle, answer } },
      leaving: {},
    },
  });
