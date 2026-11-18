# AGENTS.md

A starter for TypeScript web apps: TanStack Start + shadcn on the front, Effect v4 on the back, in a pnpm + Vite+ monorepo.

The words of the domain (User, Session, Current User, Todo, Owner) are defined in `GLOSSARY.md`. Use them as defined.

## Commands

Run from the repo root. `vp` is Vite+, the task runner, linter, formatter, and test runner.

| Command             | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `pnpm dev`          | Web and server under portless (see below)         |
| `pnpm check`        | Format check + lint (`pnpm fmt` fixes formatting) |
| `pnpm typecheck`    | `tsc` in every package, cached                    |
| `pnpm typecheck:ci` | Same with `tsrs`, as CI runs it                   |
| `pnpm test`         | Tests in every package, cached                    |
| `pnpm knip`         | Unused files, exports, and dependencies           |
| `pnpm build`        | Build the apps                                    |

`pnpm dev` runs each app through `portless run --name <name>`: it listens on a free port, behind https://quack.localhost (web) and https://api.quack.localhost (server), prefixed by the branch in a git worktree (`https://<branch>.quack.localhost`). The proxy must already run (`portless proxy start`, see the README): `pnpm dev` has no terminal to ask for `sudo`. Find a URL with `pnpm exec portless get quack`. `PORTLESS=0 pnpm dev` skips portless: web on :3000, server on :3001.

One package: `vp run --filter @quack/server test`. One file: `vp test run src/path/file.test.ts` from the package.

Before you call work done, run `pnpm check`, `pnpm typecheck`, `pnpm test`, and `pnpm knip`.

## Layout

```
apps/server             Effect HTTP API (Node)
apps/web                TanStack Start app
packages/contracts      Schemas and the HttpApi definition, shared by the server and the web app
packages/ui             shadcn components and the Tailwind theme
packages/form           Form hook and its components: TanStack Form, validated by Effect schemas
packages/ui-state       UiState: what a screen shows while data loads, matched with a case per state; the UiState of a query
packages/effect-query   TanStack Query options from Effects
packages/oxlint-plugin  Lint rules of this repo: no relative imports, module boundaries, no useless comments, no sql.unsafe outside migrations
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
    testing/         What the tests share: the suite of each port, test doubles
    index.ts         The module's Layer: handlers + use cases + the adapters that are not storage
  database/          The Postgres client and the Migrator (database.ts), the check of the migrations (migration-files.ts)
    migrations/      The migrations of every module, in one order
  server.ts          Routes, HTTP server
  main.ts            Entrypoint: chooses the storage, provides the database
```

Dependency rules, enforced by lint (`quack/module-boundaries` in `packages/oxlint-plugin`):

- `domain` imports no other layer, no `node:*`, no HTTP or platform package.
- `application` imports `domain` only. It receives adapters as Layers.
- A module never imports another module's layers. Go through its `index.ts`: `#/modules/<context>/index.ts`.
- Only a test (`*.test.ts(x)`) or another file of `testing/` imports from a `testing/` folder, so `main.ts` never loads it. A test may import another module's `testing/`, the one exception to going through its `index.ts`.

A module's `index.ts` exports the module without its storage: `IdentityModule` requires `UserRepository` and `SessionStore`, `TodosModule` requires `TodoRepository`. `main.ts` chooses the storage and provides it to `ServerLayer`, and a test provides it to the module or the `Routes` it builds, so a storage port left unprovided does not compile. `Routes` (`server.ts`) knows no storage.

`IdentityModule` implements the contract's `Authentication` middleware for every group that declares it. Another module depends on the contract (`CurrentUser`, `UserId`), never on `modules/identity`. The handlers of a protected group need the middleware when they are built, so `server.ts` provides `IdentityModule` after the other modules.

A Session expires 30 days after its last extension, with no other limit. The middleware extends it to 30 days when a request finds it with less than 15 days left, and sets the cookie again (`extension` in `modules/identity/domain/session.ts`). When it refuses a request, it clears the cookie. Every write of the cookie goes through `SessionCookie` (`modules/identity/http/session-cookie.ts`), so it is set and cleared with the same attributes. Only a User whose Status is `active` signs in (`canSignIn` in `modules/identity/domain/user.ts`): another one gets `InvalidCredentials` after the check of their password, so the refusal tells nothing to whoever does not know it, and their Session ends at its next request. A sign-in records `lastSignInAt`.

The `AttemptLimiter` (port in `modules/identity/domain/attempt-limiter.ts`) slows down the guessing of passwords: the use cases `signIn` and `signUp` call it, with the address of the client that the handler reads in `X-Forwarded-For`. There is no HTTP middleware for it. It counts the sign-ins that failed on an email (5 in 15 minutes) and from an address (20 in 15 minutes), an email no User has included, and the sign-ups from an address (10 in one hour), the failed ones included. Past a limit the use case fails with `TooManyAttempts` (429) and its `retryAfter` in seconds, before the password is hashed, and the same whether a User has the email or not. A window is fixed: it opens at the first attempt counted and the counter starts again from zero when it ends, so nothing locks a User out for good. A sign-in is counted as a failure before its password is checked, in one step with the refusal (`take`), so the sign-ins that arrive at once do not all get through; one that succeeds sets the counter of its email back to zero and is taken off the counter of its address. The limits and the windows are in `ServerConfig` (`attemptLimits`). The adapter is a counter in memory, not Effect's `RateLimiter`, which cannot set a counter back to zero.

A variable of the server goes in `ServerConfig` (`config.ts`), or in `DatabaseConfig` for the database, and in `.env.example`: in dev, `node --env-file-if-exists` loads the `.env` of the repo root. `COOKIE_SECURE` says whether the session cookie is `Secure`: true when unset, false in the `.env` of dev.

The repositories that `main.ts` provides are still in memory, so the server starts with no User, Session, or Todo. `SEED_USERS=true`, set by the `dev` script of the server, creates the Users of `devUsers()` at startup through `IdentitySeed` (`modules/identity/application/identity-seed.ts`, exported by the module's `index.ts`), which writes through `UserRepository.create`, and logs their credentials. The seed gives the same Users at every run, ids, dates, and Profiles included, so the data it creates is in a known state: ids from a seeded faker, dates spread over the two years before the fixed `seedDate`, of every Status, some with no Profile or never signed in. Every seeded User has the password hash `devPasswordHash`, a constant computed once from the dev password, so seeding hashes nothing; a test checks it still verifies. The email of the seeded `user` and `admin` and their password are in `@quack/contracts/identity/dev-accounts`, which the sign-in page also reads: in the dev build only (`import.meta.env.DEV`), it signs in as either in one click (`features/identity/dev-quick-sign-in.tsx`).

Reserve an endpoint or a group for a Role in the contract: `.middleware(RequireRole("admin"))` (`identity/require-role.ts`), declared before `.middleware(Authentication)`, so that `Authentication` runs first and provides the `CurrentUser` it reads. A Current User of another Role gets `Forbidden` (403), before the request is decoded. The Role is in the type of the middleware, and `IdentityModule` implements it for every literal of `Role` (`http/require-role-middleware.ts`): a new Role needs no other change. `IdentityModule` also serves the list of Users, since it owns the `UserRepository`.

A list that pages takes `PaginationQuery` as its query and answers its items `Paginated`, with the total (`pagination/paginated.ts`). A list that sorts adds `sortingFields(fields, defaultField)` to its query, `orderBy` and `dir` (`sorting/sorting.ts`), and breaks the ties on a field that is unique, so a page does not change from one request to the next (`UserListQuery`). An item with no value for the field (`null`) comes last, in either direction. A list that filters a field takes one value of it, optional (`role`, `status`, `team` of `UserListQuery`).

Only a handler reads `CurrentUser`. It passes the Owner to the use case as an explicit `ownerId`, and the repository filters by it (`modules/todos`): what belongs to another Owner is not found (404), never forbidden (403), so the API does not tell that it exists.

The server serves everything under `/api`, the docs (`/api/docs`) and the OpenAPI document (`/api/openapi.json`) included. It has no CORS policy: the browser reaches it through the web app's relay only.

To add a context: add its schemas and `*-api.ts` to `packages/contracts` and its group to `api.ts`, then copy the shape of `modules/todos`, add the module Layer to `server.ts`, and its storage to `main.ts`.

## Server: the database

The server stores its data in PostgreSQL, through `effect/sql` and `@effect/sql-pg`, with no ORM or query builder (`docs/adr/0001-postgres-through-effect-sql-templates.md`). In dev, `compose.yaml` at the repo root runs it, on `127.0.0.1:54320`, one container that every worktree shares (`name: quack`), its data in the `quack-postgres` volume. The `dev` script of the server goes through `src/dev/with-dev-database.ts` before the server starts: it runs `docker compose up -d --wait`, fails with `DockerNotRunning` when Docker does not run (`PostgresDidNotStart` when Docker runs but Compose fails), creates the shared database `quack` when missing, and starts the server with `DATABASE_URL` pointing at it. A `DATABASE_URL` already set (shell or `.env`) wins: the launcher uses it as given and derives nothing. The server never creates a database.

`DatabaseConfig` (`config.ts`) holds `DATABASE_URL`, required and `Redacted` (SSL in the URL: `?sslmode=require`), and `DATABASE_MAX_CONNECTIONS`, 10 when unset. It is apart from `ServerConfig`, so the tests, which read `ServerConfig` and have no database, need no `DATABASE_URL`.

`Database` (`database/database.ts`) is the `PgClient` Layer under the Migrator: it applies the pending migrations, then provides `SqlClient`. `main.ts` provides it below `ServerLayer`, so nothing serves before the schema is current, and the pool closes after the HTTP server on shutdown. When Postgres cannot be reached or refuses the credentials at startup, the process exits non-zero with `DatabaseUnreachable`, whose message names the URL with its password masked (`withoutPassword`); whatever runs the server restarts it, so there is no retry loop. `/health` touches no database: it says the process lives, and an outage of Postgres must not get every server restarted.

Migrations (`docs/adr/0002-typescript-migrations-applied-at-startup.md`):

- One file per migration in `database/migrations/`, for every module, named with a 4-digit id and a snake_case name: `0001_create_users.ts`. The ids run from 1 with no gap: the Migrator silently skips an id at or below the latest one it recorded.
- The `default` export is the up, an Effect that needs `SqlClient`, of plain SQL in a `sql` template. A named `down` export is required, the Effect that undoes it; a `down` that cannot honestly undo (data dropped) fails with a message saying why.
- `migration-files.test.ts` checks the ids and the exports, with no database.
- They run at server startup, in every environment, in one transaction, under a lock that makes instances starting at once safe. Rolling back a production database also means deploying the old code, since startup migrates forward again.
- A migration may be edited until it is merged; after that, a new migration changes the schema.
- Name every constraint (`CONSTRAINT users_email_key UNIQUE (email)`): an adapter maps a `UniqueViolation` to a domain error by its name.

Queries:

- A Postgres adapter lives in its module's `infrastructure/` and depends on `SqlClient` only. It writes one `sql` tagged template per port method, decoded by `SqlSchema` (`findAll`, `findOneOption`, `void`) with a row schema private to the adapter, which maps it to the contract's types.
- Every value is a bound parameter. `sql.unsafe` sends its text as is: lint rejects it outside `database/migrations/` (`quack/no-sql-unsafe`).
- Columns are snake_case; the client maps them to and from camelCase (`transformQueryNames`, `transformResultNames`), so a query writes `${sql("createdAt")}` or the snake_case name, and a row arrives in camelCase.
- A `SqlError` is a defect of the adapter (`Effect.orDie`), so a 500, except a `UniqueViolation` on a named constraint, mapped to the domain's error.

## Web: one folder per feature

```
apps/web/src/
  components/          Components that no feature owns and that need the router, which `@quack/ui` does not know (button-link.tsx)
  features/<context>/  Components, queries, and UI logic of one context; what only Admins use in admin/
  routes/              TanStack file routes: the route and its context only, no component
  lib/                 API client (api.ts), relay to the API (api-relay.ts)
  env/                 Environment, validated at startup: server.ts for the web server's variables
```

- What only Admins use goes in the `admin/` folder of its feature (`features/users/admin`), next to the pages of a route under `routes/_authenticated/_admin/`. Everything else stays at the root of its feature.
- A route file declares its route (`createFileRoute`, `beforeLoad`, `head`) and names its components; it defines none. A component lives in `features/`, the page of a route included (`features/identity/sign-up-page.tsx`), and the document of the root route and the layouts in `features/layout`. There it reads the router with `useNavigate()` and `useRouteContext({ from })`, since it has no `Route`.
- The web app does not depend on the server. What they share lives in `@quack/contracts`.
- The browser calls the web app's origin only. The server route `routes/api/$.ts` relays `/api/*` to the server at `API_URL`, in dev and in production, with the path unchanged: it calls `handler.handle(request, { prefix, context })` on an `ApiRelayHandler` (`lib/api-relay.ts`), the shape of an oRPC handler. The relay replaces `X-Forwarded-For` with the address it sees and checks no authentication.
- A variable of the web server goes in `env/server.ts` and has no `VITE_` prefix, so it never reaches the browser. Vite does not load such a variable from `.env`: `vite.config.ts` passes `API_URL` to `vp dev` and `vp preview` by name, so do the same for a new one. Under portless, `vite.config.ts` takes `API_URL` from `portless get api.quack` instead of `.env`.
- Call the API with the query options of `api` (`lib/api.ts`): `useQuery(api.todos.list.queryOptions())`, `useMutation(api.todos.create.mutationOptions())`. The client is derived from the contract's `Api`, so there is no client to keep in sync by hand.
- The root route loads the Current User before every navigation, in the server render and in the browser, and every route gets it as `context.currentUser` (`null` for a visitor): read it in a `beforeLoad` or with `Route.useRouteContext()`. It is the encoded User, since it crosses from the web server to the browser.
- The Current User lives in the query cache under `["me"]` (`features/identity/current-user.ts`), filled by the server function `getCurrentUser`: the session cookie is `HttpOnly` and a server render has no browser, so the web server sends the request's cookie to the API's `me`, names the client in `X-Forwarded-For` as the relay does, and sends the API's `Set-Cookie` back. After a call that changes who the Current User is, call `useSetCurrentUser()` with the User, or `null` after a sign-out: it updates `["me"]`, drops every other query of the cache, since they hold the data of the User before, then invalidates the router.
- A page for a Current User only goes under `routes/_authenticated/`: its layout `routes/_authenticated/route.tsx` has no path, and redirects a visitor to `/sign-in?redirect=<the page>`, which leads back once they are signed in. Below it, `context.currentUser` is never `null`.
- That layout renders `AppLayout` (`features/layout/app-layout.tsx`): the sidebar (`app-sidebar.tsx`), with a link per page and the menu of the Current User (`features/identity/user-menu.tsx`), and the page. Add a page to the sidebar in `app-sidebar.tsx`. A page renders its own top bar, `PageHeader` (`features/layout/page-header.tsx`), with what it shows there as children (`features/todos/todos-page.tsx`). Whether the sidebar is open is kept in the `sidebar_state` cookie, read in the `beforeLoad` of the layout (`features/layout/sidebar-open.ts`), so the server render draws it as the browser will.
- A page for Admins only goes under `routes/_authenticated/_admin/`: its layout `routes/_authenticated/_admin/route.tsx` has no path and no component, and redirects a Current User of another Role to `/`. The API refuses them anyway (`RequireRole`); the redirect spares them a page that can only fail.
- A call of the API that fails with `Unauthenticated` needs no handling where it is made: the `QueryCache` and the `MutationCache` of the `QueryClient` (`router.tsx`) set the Current User to `null` and lead to `/sign-in?redirect=<the current page>`. Such a call is not retried. `signInLocation` (`features/identity/redirect-target.ts`) is that link, for the layout of the protected pages too.
- A page for visitors only goes under `routes/_guest/` (`sign-in.tsx`, `sign-up.tsx`), whose layout `GuestLayout` (`features/layout/guest-layout.tsx`) centers its card, with no bar. Such a page redirects a Current User in its `beforeLoad`. The `redirect` of the sign-in page comes from a link anyone can write: read it through `redirectTarget` (`features/identity/redirect-target.ts`), which answers a path of the app or `/`. Validate the search of a route with an Effect schema: `validateSearch: Schema.toStandardSchemaV1(SignInSearch)` (`features/identity/sign-in-search.ts`).
- Link to a page with the look of a button through `ButtonLink` (`components/button-link.tsx`): the `to` of a `Link`, the `variant` and `size` of a `Button`.
- A list that pages keeps its page in the URL: a `page` search validated by `PageSearch`, which answers 1 for anything else (`components/page-pagination.tsx`), the query with `placeholderData: keepPreviousData`, and the table `aria-busy` while the next page loads. Render it with `DataTable` and `PagePagination` (`components/page-pagination.tsx`) in its footer (`features/users/admin/users-table.tsx`): it links to the pages of the current route through `page`, keeps the rest of the search, and marks the current page from the validated `page`, not by the router. Its links are `ButtonLink`s, not `PaginationLink`, which gives its `<a>` the role of a button.
- Render a query through `matchQuery(query, { Pending, Error, Success })` (`@quack/ui-state/query`), not with `isPending` and `data === undefined`: a state left without a case does not compile. A refetch that fails stays `Success`, with its `refreshError`. Anything else that loads (a mutation, an Effect run by hand) answers a `UiState` (`@quack/ui-state/ui-state`) and is matched with `UiState.match`, which asks a case for each state its type can hold, `Idle` included.
- The `QueryClient` is in the router's context (`context.queryClient`), the same one the components use. No other data is loaded in the server render: the API client has no cookie there.
- The forms of `/sign-in` and `/sign-up` say how long to wait when the API refuses with `TooManyAttempts`: `tooManyAttemptsMessage` (`features/identity/too-many-attempts-message.ts`).
- Build forms with `@quack/form`: see "Form package" below.
- `src/routeTree.gen.ts` is generated by `vp dev` and `vp build`. Do not edit it. Commit it.

## UI package

Add a component from `packages/ui`: `pnpm dlx shadcn@latest add <name>`. Import it as `@quack/ui/components/<name>`, and a hook as `@quack/ui/hooks/<name>`. Do not edit generated components to restyle one screen; pass `className` or compose.

`DataTable` (`components/data-table.tsx`) is shadcn's data-table recipe on TanStack Table v9: `columns` (`DataTableColumn<T>`), `data`, `getRowId`, and slots for the empty state and the footer. It sorts, filters, and pages nothing itself: the API does.

`SearchInput` (`components/search-input.tsx`) calls `onSearch` with the trimmed text once the typing pauses (`delay`, 300 ms), at once on Enter or when the text is cleared, and never twice in a row with the same text. It holds its text itself: give it a new `key` to replace it.

## Form package

`packages/form` is TanStack Form with the repo's components, validated by Effect schemas. It imports `@quack/ui`; `@quack/ui` knows no form library.

- Build a form with `useAppForm` from `@quack/form/use-app-form`: `form.AppForm` around `form.Root`, which holds each `form.AppField` and the `form.SubmitButton`. Copy `apps/web/src/features/todos/todos-form.tsx`.
- Compose a field from its parts: `field.Root` frames it and sets its `size` (`sm`, `md`, `lg`), `field.Label` is its label, placed where the layout wants it, and `field.Text` is the control with its errors. A control used without a label takes an `aria-label`.
- Validate a form with an Effect schema: spread `schemaFormOptions(Schema, defaultValues)` into `useAppForm`. Validation does not transform the values, so decode them with the same schema in `onSubmit`.
- When the request of `onSubmit` fails, throw `new SubmitFailed(message)`: `form.Root` shows the message until the next edit, and the form does not report a success. Any other error thrown by `onSubmit` is reported as a bug.
- Add a control as a field component in its own file of `packages/form/src`, and register it in `use-app-form.ts`. Name the component `FormXxx`, so it is not taken for the `@quack/ui` component it wraps, and register it under the short name, which `field.` or `form.` already prefixes: `FormTextField` is `field.Text`. Like `FormTextField`, it renders the control and its errors, not the label. It takes its id and size from `useFormFieldLayout()`, wires the error and the invalid state to the control (`aria-describedby`, `aria-invalid`), and sets the control's `name` to the field's: after a submit that fails validation, `form.Root` focuses the first element with `aria-invalid` and reads the errors of the field of that `name`.
- Test a form or a form component in a real browser (Vitest browser mode, Chromium through Playwright), with `vitest-browser-react` and the locators of `vite-plus/test/browser`: `packages/form/src/form-submit-button.test.tsx` for a component, `apps/web/src/features/todos/todos-form.test.tsx` for a form, with `fetch` stubbed. Assert what a user or assistive tech gets: the focus, the accessible name and description, what the live region says.

## Conventions

- File names are kebab-case (`todo-repository.ts`, `todos-list.tsx`); lint rejects anything else (`unicorn/filename-case`). The exported class or component keeps its PascalCase name.
- No relative imports (`./x`, `../x`); lint rejects them. Import through the package alias: `#/` is the package's `src` folder, with the file extension (`import { Todo } from "#/modules/todos/domain/todo.ts"`). It is the `imports` field of each `package.json`, which Node, TypeScript, and Vite all resolve.
- Effect v4. Its docs for agents ship in `apps/server/node_modules/effect/ai-docs`. Read them before writing Effect code: the v4 API differs from v3 (`Context.Service`, `effect/http`, `effect/http-api`).
- Services are `Context.Service` classes with a static `layer`. Service methods use `Effect.fn("Service.method")`, written inline in `Service.of({ ... })`, which types their parameters: no `const method = Effect.fn(...)` passed by name. A helper that several methods share stays a local function.
- Errors are `Schema.TaggedError` classes. Fail with typed errors; do not throw.
- Tests sit next to the code as `*.test.ts`, which run in Node, or `*.test.tsx` for components, which run in a real browser: a simulated DOM has no focus rules, no keyboard, no accessibility tree, and no stylesheet. Install the browser once: `pnpm --filter @quack/form exec playwright install chromium`. Effect code uses `@effect/vitest` (`it.effect`, `layer`). Test handlers through `HttpApiTest`, with no server. It builds the routes of the whole `Api`, so the test Layer provides every middleware the `Api` declares: `IdentityModule`, or outside the identity module implementations of the test's own, an `Authentication` that names the Current User and a `RequireRole` for each Role the `Api` requires (`apps/server/src/modules/todos/http/todos-handlers.test.ts`), with `Layer.provideMerge` when the handlers under test are protected. A client keeps its cookies as `makeBrowser` does in `apps/server/src/modules/identity/http/identity-handlers.test.ts`. That client sends no `X-Forwarded-For`, so all its requests come from one address: a test of the `AttemptLimiter` builds the module for itself (`withLimits`), and its counters start empty. What the routes add to the handlers (the docs, the OpenAPI document, no CORS) is tested on the assembled `Routes`, through `HttpRouter.toWebHandler`: `apps/server/src/server.test.ts`. So is an endpoint that reads the cookie without declaring `Authentication` (`signOut`): the client of `HttpApiTest` sends a cookie to the endpoints that declare it only. So is what depends on the address of the client, read in `X-Forwarded-For`.
- A storage port states its promises as one suite in the `testing/` folder of its module, which takes an adapter's Layer (`todoRepositorySuite(layer)` in `modules/todos/testing/todo-repository-suite.ts`) and runs from the test file of each adapter (`todo-repository-memory.test.ts`), so no adapter drifts from the port. The port keeps no doc comment that says a promise of its suite.
- Shared dependency versions live in the `catalog:` of `pnpm-workspace.yaml`.
- No comment by default. A comment says why the code is the way it is, or a constraint the code cannot show (a security reason, a browser quirk, a unit). It never says what the code or its names already say, narrates a step, describes a test's setup, or repeats a rule of this file. A number a test explains in a comment becomes an expression (`Duration.toSeconds(sessionLifetime)`). Lint rejects the comments it can recognize (`quack/no-useless-comments`): one that restates the code next to it, one that narrates (`Port.`, `Use cases of`, `This function`), and commented-out code.
- A flaky test is fixed, not retried.
- Tests run in a random order (`sequence: { shuffle: true }`), and the seed is in the output: `vp test run --sequence.seed=<seed>` replays it. A test leaves nothing another one reads, and assumes nothing a test before it may have changed: the tests of one `layer(...)` share its services and its `TestClock`, so read the time with `DateTime.now` rather than assume the epoch, and take an email or an address of its own.
- The files of a browser project run one at a time (`fileParallelism: false`): only one page of a browser has the focus, so the keystrokes of a file running in parallel go to another.
- The pre-push hook (`.vite-hooks/pre-push`) runs `vp check` and the typecheck. CI runs the tests of the web app in a job of its own, and fails a job that takes longer than its `timeout-minutes`: find what made it slow rather than raise it.
