# AGENTS.md

A starter for TypeScript web apps: TanStack Start + shadcn on the front, Effect v4 on the back, in a pnpm + Vite+ monorepo.

## Commands

Run from the repo root. `vp` is Vite+, the task runner, linter, formatter, and test runner.

| Command             | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `pnpm dev`          | Web on :3000 and server on :3001                  |
| `pnpm check`        | Format check + lint (`pnpm fmt` fixes formatting) |
| `pnpm typecheck`    | `tsc` in every package, cached                    |
| `pnpm typecheck:ci` | Same with `tsrs`, as CI runs it                   |
| `pnpm test`         | Tests in every package, cached                    |
| `pnpm knip`         | Unused files, exports, and dependencies           |
| `pnpm build`        | Build the apps                                    |

One package: `vp run --filter @quack/server test`. One file: `vp test run src/path/file.test.ts` from the package.

Before you call work done, run `pnpm check`, `pnpm typecheck`, `pnpm test`, and `pnpm knip`.

## Layout

```
apps/server             Effect HTTP API (Node)
apps/web                TanStack Start app
packages/contracts      Schemas and the HttpApi definition, shared by the server and the web app
packages/ui             shadcn components and the Tailwind theme
packages/oxlint-plugin  Lint rules of this repo: no relative imports, module boundaries
```

Packages import each other's TypeScript sources through `exports`. There is no build step between packages.

## Contracts: what the server and the web app agree on

```
packages/contracts/src/
  <context>/         Schemas of the context (entities, value objects, tagged errors) and its HttpApiGroup (*-api.ts)
  api.ts             The HttpApi: every group, assembled
```

- The server implements `Api`; the web app derives its client from it. Neither imports the other.
- Import a file by its path: `@quack/contracts/api`, `@quack/contracts/todos/todo`. There is no barrel.
- Contracts run on the server and in the browser. They import `effect` only: no `node:*`, no platform package, no other workspace package. Lint enforces it.
- Contracts hold data and its validation. Behavior stays in the server's domain (`completeTodo` in `modules/todos/domain/todo.ts`).
- HTTP status codes are set on the endpoint (`HttpApiSchema.status(404)` on the error in `*-api.ts`), not on the error class.

## Server: one folder per bounded context

```
apps/server/src/
  modules/<context>/
    domain/          Behavior over the contract's schemas, ports (Context.Service)
    application/     Use cases. Depend on the domain only
    infrastructure/  Layers that implement the domain's ports
    http/            Handlers of the context's HttpApiGroup (*-handlers.ts)
    index.ts         The module's Layer: handlers + use cases + chosen adapters
  server.ts          Routes, CORS, HTTP server
  main.ts            Entrypoint
```

Dependency rules, enforced by lint (`quack/module-boundaries` in `packages/oxlint-plugin`):

- `domain` imports no other layer, no `node:*`, no HTTP or platform package.
- `application` imports `domain` only. It receives adapters as Layers.
- A module never imports another module's layers. Go through its `index.ts`: `#/modules/<context>/index.ts`.

To add a context: add its schemas and `*-api.ts` to `packages/contracts` and its group to `api.ts`, then copy the shape of `modules/todos` and add the module Layer to `server.ts`.

## Web: one folder per feature

```
apps/web/src/
  features/<context>/  Components, queries, and UI logic of one context
  routes/              TanStack file routes. Thin: they compose features
  lib/                 API client (api.ts), environment (env.ts)
  lib/form/            Form hook (useAppForm.ts) and its components, one per file
```

- The web app does not depend on the server. What they share lives in `@quack/contracts`.
- Call the API with `callApi((api) => api.todos.list())`. The client is derived from the contract's `Api`, so there is no client to keep in sync by hand.
- Build forms with `useAppForm` from `#/lib/form/useAppForm.ts` (TanStack Form with the app's components): `form.AppForm` around `form.Form`, which holds each `form.AppField` and the `form.FormSubmitButton`.
- Compose a field from its parts: `field.FormField` frames it and sets its `size` (`sm`, `md`, `lg`), `field.FormLabel` is its label, placed where the layout wants it, and `field.FormTextField` is the control with its errors. A control used without a label takes an `aria-label`.
- Validate a form with an Effect schema: spread `schemaFormOptions(Schema, defaultValues)` into `useAppForm`. Validation does not transform the values, so decode them with the same schema in `onSubmit`.
- When the request of `onSubmit` fails, throw `new SubmitFailed(message)`: `form.Form` shows the message until the next edit, and the form does not report a success. Any other error thrown by `onSubmit` is reported as a bug.
- Add a control as a field component in its own file of `lib/form/`, and register it in `useAppForm.ts`. Like `FormTextField`, it renders the control and its errors, not the label. It takes its id and size from `useFormFieldLayout()`, wires the error and the invalid state to the control (`aria-describedby`, `aria-invalid`), and sets the control's `name` to the field's: after a submit that fails validation, `form.Form` focuses the first element with `aria-invalid` and reads the errors of the field of that `name`.
- `src/routeTree.gen.ts` is generated by `vp dev` and `vp build`. Do not edit it. Commit it.

## UI package

Add a component from `packages/ui`: `pnpm dlx shadcn@latest add <name>`. Import it as `@quack/ui/components/<name>`. Do not edit generated components to restyle one screen; pass `className` or compose.

## Conventions

- File names are kebab-case (`todo-repository.ts`, `todos-card.tsx`); lint rejects anything else (`unicorn/filename-case`). The exported class or component keeps its PascalCase name.
- No relative imports (`./x`, `../x`); lint rejects them. Import through the package alias: `#/` is the package's `src` folder, with the file extension (`import { Todo } from "#/modules/todos/domain/todo.ts"`). It is the `imports` field of each `package.json`, which Node, TypeScript, and Vite all resolve.
- Effect v4. Its docs for agents ship in `apps/server/node_modules/effect/ai-docs`. Read them before writing Effect code: the v4 API differs from v3 (`Context.Service`, `effect/http`, `effect/http-api`).
- Services are `Context.Service` classes with a static `layer`. Service methods use `Effect.fn("Service.method")`.
- Errors are `Schema.TaggedError` classes. Fail with typed errors; do not throw.
- Tests sit next to the code as `*.test.ts`. Effect code uses `@effect/vitest` (`it.effect`, `layer`). Test handlers through `HttpApiTest`, with no server.
- Shared dependency versions live in the `catalog:` of `pnpm-workspace.yaml`.
- A flaky test is fixed, not retried.
