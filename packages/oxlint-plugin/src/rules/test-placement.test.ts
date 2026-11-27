import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

import rule from "#/rules/test-placement.ts";

RuleTester.describe = describe;

RuleTester.it = it;

// A worktree sits in a dot folder, which `**` would not cross: the globs are relative to the linter's cwd.
const cwd = "/home/.worktrees/repo";

const options = [
  { allow: ["apps/server/src/modules/*/*.test.ts", "apps/web/src/*.test.{ts,tsx}"] },
];

const code = `it("works", () => {});`;

const OUTSIDE = {
  message:
    "A test sits only at a tested interface, and this path is none: test it through its module's index.ts.",
};

new RuleTester({ cwd }).run("test-placement", rule, {
  valid: [
    { filename: `${cwd}/apps/server/src/modules/todos/todos.test.ts`, code, options },
    { filename: `${cwd}/apps/web/src/routes-redirects.test.tsx`, code, options },
    { filename: `${cwd}/apps/server/src/modules/todos/lib/todos.ts`, code, options },
  ],
  invalid: [
    {
      filename: `${cwd}/apps/server/src/modules/todos/lib/todos.test.ts`,
      code,
      options,
      errors: [OUTSIDE],
    },
    {
      filename: `${cwd}/apps/web/src/features/todos/todos-list.test.tsx`,
      code,
      options,
      errors: [OUTSIDE],
    },
    { filename: `${cwd}/apps/server/src/server.test.ts`, code, errors: [OUTSIDE] },
  ],
});
