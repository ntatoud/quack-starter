import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

import rule from "#/rules/no-useless-comments.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const filename = "/repo/apps/web/src/features/todos/queries.ts";
const RESTATES = {
  message:
    "The comment restates the code next to it. Delete it, or say why the code is the way it is.",
};
const NARRATES = {
  message:
    "The comment narrates what the code is. Delete it, or say why the code is the way it is.",
};
const CODE = { message: "Commented-out code. Delete it: git keeps the history." };

new RuleTester().run("no-useless-comments", rule, {
  valid: [
    {
      filename,
      code: `// Appended, not set: setting the header would replace the cookies already on the response.\nappendHeader("set-cookie", value);`,
    },
    {
      filename,
      code: `/** A hash this adapter cannot read is \`false\`, not an error. */\ninterface Hasher { verify(hash: string): boolean }`,
    },
    { filename, code: `// oxlint-disable-next-line no-console\nconsole.log(1);` },
    {
      filename,
      code: `// @ts-expect-error The DOM types lack it.\nconst init = { duplex: "half" };`,
    },
    {
      filename,
      code: `/** @effect-expect-leaking HttpServerRequest */\nexport class SessionCookie {}`,
    },
    {
      filename,
      code: `// Rounded up: an attempt made \`retryAfter\` seconds later finds the window ended.\nconst retryAfter = Math.ceil(wait / 1000);`,
    },
    { filename, code: `const total = 1; // KiB, as the Kdf takes it.` },
  ],
  invalid: [
    {
      filename,
      code: `/** The number of random bytes in a Session token. */\nexport const sessionTokenBytes = 32;`,
      errors: [RESTATES],
    },
    { filename, code: `// Creates the user.\nconst createUser = () => {};`, errors: [RESTATES] },
    {
      filename,
      code: `// Remove the todo\n// from the list.\nlist.removeTodo(id);`,
      errors: [RESTATES],
    },
    { filename, code: `const users = load(); // load users`, errors: [RESTATES] },
    {
      filename,
      code: `/** Port. The domain owns the interface. */\nexport class TodoRepository {}`,
      errors: [NARRATES],
    },
    {
      filename,
      code: `/** Use cases of the todos context. */\nexport class Todos {}`,
      errors: [NARRATES],
    },
    {
      filename,
      code: `// This function adds two numbers.\nconst add = (a, b) => a + b;`,
      errors: [NARRATES],
    },
    { filename, code: `// const old = compute();\nconst value = 1;`, errors: [CODE] },
    { filename, code: `// import { x } from "y";\nconst value = 1;`, errors: [CODE] },
    {
      filename,
      code: `/*\n * if (ready) {\n *   start();\n * }\n */\nconst value = 1;`,
      errors: [CODE],
    },
  ],
});
