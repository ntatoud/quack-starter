# AGENTS.md

A starter for TypeScript web apps: TanStack Start + shadcn on the front, Effect v4 on the back, in a pnpm + Vite+ monorepo.

The words of the domain (User, Session, Current User, Todo, Owner) are defined in `GLOSSARY.md`. Use them as defined.

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
packages/form           Form hook and its components: TanStack Form, validated by Effect schemas
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
- Every endpoint is under `/api`: `Api` takes the prefix `API_PREFIX` (`api.ts`), so a group's paths do not repeat it (`/todos` is served at `/api/todos`).
- HTTP status codes are set on the endpoint (`HttpApiSchema.status(404)` on the error in `*-api.ts`), not on the error class.
- Protect an endpoint or a group by declaring it in the contract: `.middleware(Authentication)` (`identity/authentication.ts`), after the endpoints it covers, since it skips the ones added later. Its handlers read `CurrentUser`, and its client gets `Unauthenticated` (401). The Session travels in the `session` cookie.

## Server: one folder per bounded context

```
apps/server/src/
  modules/<context>/
    domain/          Behavior over the contract's schemas, ports (Context.Service)
    application/     Use cases. Depend on the domain only
    infrastructure/  Layers that implement the domain's ports
    http/            Handlers of the context's HttpApiGroup (*-handlers.ts)
    index.ts         The module's Layer: handlers + use cases + chosen adapters
  server.ts          Routes, HTTP server
  main.ts            Entrypoint
```

Dependency rules, enforced by lint (`quack/module-boundaries` in `packages/oxlint-plugin`):

- `domain` imports no other layer, no `node:*`, no HTTP or platform package.
- `application` imports `domain` only. It receives adapters as Layers.
- A module never imports another module's layers. Go through its `index.ts`: `#/modules/<context>/index.ts`.

`IdentityModule` implements the contract's `Authentication` middleware for every group that declares it. Another module depends on the contract (`CurrentUser`, `UserId`), never on `modules/identity`. The handlers of a protected group need the middleware when they are built, so `server.ts` provides `IdentityModule` after the other modules.

Only a handler reads `CurrentUser`. It passes the Owner to the use case as an explicit `ownerId`, and the repository filters by it (`modules/todos`): what belongs to another Owner is not found (404), never forbidden (403), so the API does not tell that it exists.

The server serves everything under `/api`, the docs (`/api/docs`) and the OpenAPI document (`/api/openapi.json`) included. It has no CORS policy: the browser reaches it through the web app's relay only.

To add a context: add its schemas and `*-api.ts` to `packages/contracts` and its group to `api.ts`, then copy the shape of `modules/todos` and add the module Layer to `server.ts`.

## Web: one folder per feature

```
apps/web/src/
  components/          Components that no feature owns and that need the router, which `@quack/ui` does not know (button-link.tsx)
  features/<context>/  Components, queries, and UI logic of one context
  routes/              TanStack file routes: the route and its context only, no component
  lib/                 API client (api.ts), relay to the API (api-relay.ts)
  env/                 Environment, validated at startup: server.ts for the web server's variables
```

- A route file declares its route (`createFileRoute`, `beforeLoad`, `head`) and names its components; it defines none. A component lives in `features/`, the page of a route included (`features/identity/sign-up-page.tsx`), and the document and layout of the root route in `features/layout`. There it reads the router with `useNavigate()` and `useRouteContext({ from })`, since it has no `Route`.
- The web app does not depend on the server. What they share lives in `@quack/contracts`.
- The browser calls the web app's origin only. The server route `routes/api/$.ts` relays `/api/*` to the server at `API_URL`, in dev and in production, with the path unchanged: it calls `handler.handle(request, { prefix, context })` on an `ApiRelayHandler` (`lib/api-relay.ts`), the shape of an oRPC handler. The relay replaces `X-Forwarded-For` with the address it sees and checks no authentication.
- A variable of the web server goes in `env/server.ts` and has no `VITE_` prefix, so it never reaches the browser. Vite does not load such a variable from `.env`: `vite.config.ts` passes `API_URL` to `vp dev` and `vp preview` by name, so do the same for a new one.
- Call the API with the query options of `api` (`lib/api.ts`): `useQuery(api.todos.list.queryOptions())`, `useMutation(api.todos.create.mutationOptions())`. The client is derived from the contract's `Api`, so there is no client to keep in sync by hand.
- The root route loads the Current User before every navigation, in the server render and in the browser, and every route gets it as `context.currentUser` (`null` for a visitor): read it in a `beforeLoad` or with `Route.useRouteContext()`. It is the encoded User, since it crosses from the web server to the browser.
- The Current User lives in the query cache under `["me"]` (`features/identity/current-user.ts`), filled by the server function `getCurrentUser`: the session cookie is `HttpOnly` and a server render has no browser, so the web server sends the request's cookie to the API's `me`, names the client in `X-Forwarded-For` as the relay does, and sends the API's `Set-Cookie` back. After a call that changes who the Current User is, call `useSetCurrentUser()` with the User, or `null` after a sign-out: it updates `["me"]`, drops every other query of the cache, since they hold the data of the User before, then invalidates the router.
- A page for a Current User only goes under `routes/_authenticated/`: the layout `routes/_authenticated.tsx` has no path, and redirects a visitor to `/sign-in?redirect=<the page>`, which leads back once they are signed in.
- A call of the API that fails with `Unauthenticated` needs no handling where it is made: the `QueryCache` and the `MutationCache` of the `QueryClient` (`router.tsx`) set the Current User to `null` and lead to `/sign-in?redirect=<the current page>`. Such a call is not retried. `signInLocation` (`features/identity/redirect-target.ts`) is that link, for the layout of the protected pages too.
- A page for visitors only (`routes/sign-in.tsx`, `routes/sign-up.tsx`) redirects a Current User in its `beforeLoad`. The `redirect` of the sign-in page comes from a link anyone can write: read it through `redirectTarget` (`features/identity/redirect-target.ts`), which answers a path of the app or `/`. Validate the search of a route with an Effect schema: `validateSearch: Schema.toStandardSchemaV1(SignInSearch)` (`features/identity/sign-in-search.ts`).
- Link to a page with the look of a button through `ButtonLink` (`components/button-link.tsx`): the `to` of a `Link`, the `variant` and `size` of a `Button`.
- The `QueryClient` is in the router's context (`context.queryClient`), the same one the components use. No other data is loaded in the server render: the API client has no cookie there.
- Build forms with `@quack/form`: see "Form package" below.
- `src/routeTree.gen.ts` is generated by `vp dev` and `vp build`. Do not edit it. Commit it.

## UI package

Add a component from `packages/ui`: `pnpm dlx shadcn@latest add <name>`. Import it as `@quack/ui/components/<name>`. Do not edit generated components to restyle one screen; pass `className` or compose.

## Form package

`packages/form` is TanStack Form with the repo's components, validated by Effect schemas. It imports `@quack/ui`; `@quack/ui` knows no form library.

- Build a form with `useAppForm` from `@quack/form/use-app-form`: `form.AppForm` around `form.Root`, which holds each `form.AppField` and the `form.SubmitButton`. Copy `apps/web/src/features/todos/todos-form.tsx`.
- Compose a field from its parts: `field.Root` frames it and sets its `size` (`sm`, `md`, `lg`), `field.Label` is its label, placed where the layout wants it, and `field.Text` is the control with its errors. A control used without a label takes an `aria-label`.
- Validate a form with an Effect schema: spread `schemaFormOptions(Schema, defaultValues)` into `useAppForm`. Validation does not transform the values, so decode them with the same schema in `onSubmit`.
- When the request of `onSubmit` fails, throw `new SubmitFailed(message)`: `form.Root` shows the message until the next edit, and the form does not report a success. Any other error thrown by `onSubmit` is reported as a bug.
- Add a control as a field component in its own file of `packages/form/src`, and register it in `use-app-form.ts`. Name the component `FormXxx`, so it is not taken for the `@quack/ui` component it wraps, and register it under the short name, which `field.` or `form.` already prefixes: `FormTextField` is `field.Text`. Like `FormTextField`, it renders the control and its errors, not the label. It takes its id and size from `useFormFieldLayout()`, wires the error and the invalid state to the control (`aria-describedby`, `aria-invalid`), and sets the control's `name` to the field's: after a submit that fails validation, `form.Root` focuses the first element with `aria-invalid` and reads the errors of the field of that `name`.
- Test a form or a form component in a real browser (Vitest browser mode, Chromium through Playwright), with `vitest-browser-react` and the locators of `vite-plus/test/browser`: `packages/form/src/form-submit-button.test.tsx` for a component, `apps/web/src/features/todos/todos-form.test.tsx` for a form, with `fetch` stubbed. Assert what a user or assistive tech gets: the focus, the accessible name and description, what the live region says.

## Conventions

- File names are kebab-case (`todo-repository.ts`, `todos-card.tsx`); lint rejects anything else (`unicorn/filename-case`). The exported class or component keeps its PascalCase name.
- No relative imports (`./x`, `../x`); lint rejects them. Import through the package alias: `#/` is the package's `src` folder, with the file extension (`import { Todo } from "#/modules/todos/domain/todo.ts"`). It is the `imports` field of each `package.json`, which Node, TypeScript, and Vite all resolve.
- Effect v4. Its docs for agents ship in `apps/server/node_modules/effect/ai-docs`. Read them before writing Effect code: the v4 API differs from v3 (`Context.Service`, `effect/http`, `effect/http-api`).
- Services are `Context.Service` classes with a static `layer`. Service methods use `Effect.fn("Service.method")`, written inline in `Service.of({ ... })`, which types their parameters: no `const method = Effect.fn(...)` passed by name. A helper that several methods share stays a local function.
- Errors are `Schema.TaggedError` classes. Fail with typed errors; do not throw.
- Tests sit next to the code as `*.test.ts`, which run in Node, or `*.test.tsx` for components, which run in a real browser: a simulated DOM has no focus rules, no keyboard, no accessibility tree, and no stylesheet. Install the browser once: `pnpm --filter @quack/form exec playwright install chromium`. Effect code uses `@effect/vitest` (`it.effect`, `layer`). Test handlers through `HttpApiTest`, with no server. It builds the routes of the whole `Api`, so the test Layer provides an `Authentication`: `IdentityModule`, or outside the identity module an implementation of the test's own that names the Current User (`apps/server/src/modules/todos/http/todos-handlers.test.ts`), with `Layer.provideMerge` when the handlers under test are protected. A client keeps its cookies as `makeBrowser` does in `apps/server/src/modules/identity/http/identity-handlers.test.ts`. What the routes add to the handlers (the docs, the OpenAPI document, no CORS) is tested on the assembled `Routes`, through `HttpRouter.toWebHandler`: `apps/server/src/server.test.ts`. So is an endpoint that reads the cookie without declaring `Authentication` (`signOut`): the client of `HttpApiTest` sends a cookie to the endpoints that declare it only.
- Shared dependency versions live in the `catalog:` of `pnpm-workspace.yaml`.
- A flaky test is fixed, not retried.
