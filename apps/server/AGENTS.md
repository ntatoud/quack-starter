# Server

Effect HTTP API, one folder per bounded context in `src/modules/`. Before changing sign-in, sign-up, Sessions, the `AttemptLimiter`, or the seed, read `docs/identity.md`; before changing Password Reset, `docs/password-reset.md`.

## Modules

To add a context, copy `modules/todos`:

1. Add its schemas and `*-api.ts` to `packages/contracts`, and its group to `api.ts`.
2. Write `domain/` (behavior, ports), `application/` (use cases), `infrastructure/` (adapters), `http/` (handlers), `testing/` (port suites, test doubles). Lint tells what each layer may import (`quack/module-boundaries`).
3. Export from `index.ts` the module without its storage (`TodosModule` requires `TodoRepository`) and its Postgres adapters apart (`TodosPostgres`).
4. Add the module to `server.ts`, before `IdentityModule`, and its storage to `main.ts`.

- A module reaches another one through its `index.ts`, and identity through the contract (`CurrentUser`, `UserId`).
- Only a handler reads `CurrentUser`. It passes the Owner to the use case as `ownerId`, and the repository filters by it: another Owner's data is not found (404), so the API never tells that it exists.
- A server variable goes in `ServerConfig` (`config.ts`), or `DatabaseConfig` for the database, and in `.env.example`.
- Writes of several stores that stand or fall together run in `Transaction.run` (`modules/transaction`): Postgres runs them in one transaction, the memory adapters as they come. Writes of one adapter use `sql.withTransaction` in it.
- A mail goes out through `Mailer` (`modules/mail`, exported from its `index.ts` once a module sends one), which returns before it is sent and never fails: a failed send is logged and the mail lost. A link in it starts from `ServerConfig.publicOrigin`, never from the request. Tests provide `MailerMemory` and read `SentMails`. Its content comes from a template of `@quack/emails`, which is `.tsx`: Node loads it through `--import @quack/emails/register`, which the `dev` and `start` scripts pass.
- `/health` touches no database, so an outage of Postgres does not get every server restarted.

## MCP

`src/mcp/` is a transport, not a module: it serves `/api/mcp` with a tool for each endpoint the contract offers, which calls the `Api` in process as the `McpCaller` of the request, so the Permission check and the Owner rules stay those of the `Api`. A context adds tools through the contract only. The flow, from discovery to a tool call: `docs/ai-clients.md`.

- Only `/api/mcp` reads a bearer token (ADR 0003): `Grants.authenticate` turns it into the `McpCaller`, the Grant's User with the token's Permissions that the Grant and their Role still give. Never accept one on `/api`.
- An HTTP middleware answers 401 or 403 before any JSON-RPC; an `McpServer.middleware` provides the `McpCaller`. The tools are built outside the scope of the HTTP middleware (`mcp-endpoint.ts`): inside it, it would also wrap the in-process routes and challenge every call.
- A Grant is one per User and AI Client, in identity: `GrantStore` holds it and its access and refresh tokens, stored as SHA-256 only. Approving creates or updates it, and revokes its tokens; the token endpoint (`Grants.exchange`) issues its tokens, for a code or a refresh token. A replaced refresh token presented again revokes the Grant; lifetimes: `docs/ai-clients.md`.

## Database

Migrations built by Kysely and run by Effect SQL, tables typed by kysely-codegen (`docs/adr/0007-queries-built-by-kysely-run-by-effect-sql.md`); queries are `sql` templates until they move to `db` too. Which database a worktree uses: README.

- An adapter copies `modules/todos/infrastructure/todo-repository-postgres.ts`: one `sql` template per port method, decoded by `SqlSchema` through a row schema private to the adapter.
- Columns are snake_case and rows arrive in camelCase: write `${sql("createdAt")}`.
- `database/db.gen.ts` is generated: after a migration changes the schema, run it on the dev database and `pnpm db:gen`, and commit the file with the migration. CI fails when they disagree. Tables and columns are camelCase in TypeScript, snake_case in Postgres.
- A `SqlError` is a defect (`Effect.orDie`), except a `UniqueViolation`, mapped to the domain's error by the name of its constraint. So name every constraint: `.addUniqueConstraint("users_email_key", ["email"])`.

Migrations (`docs/adr/0002-typescript-migrations-applied-at-startup.md`) live in `database/migrations/`, for every module:

- A migration builds its statements with `db.schema` and runs them through `executor`; copy `0003_create_todos.ts`.
- Edit a migration until it is merged; after that, add a new one.
- A `down` that cannot honestly undo (data dropped) fails with a message saying why.
- Dev loop: the server applies the migration at startup, `pnpm db:rollback` reverts it, edit, restart, `pnpm db:gen`.
- A branch that changes the schema, a migration edited in place included, sets `DEV_DATABASE=own` in its checkout's `.env` before `pnpm dev`: `pnpm dev` gives a database of its own only to a branch that adds a migration file, and the shared `quack` must keep the schema of `main`.
- `pnpm db:seed` resets the database to the seed. On the shared `quack` database, that wipes it for every worktree.

## Tests

- A storage port states its promises as one suite in `testing/` that takes an adapter's Layer (`todoRepositorySuite(layer)`), run from each adapter's test file. Its memory adapter is a test double, in `testing/` too.
- A flow across requests has a model in `testing/`, an `xstate/fsm` machine: the Grant of an AI Client (`grant-model.ts`), a User's Session and Password Reset (`session-model.ts`). Its handler test replays `coveringWalks`, which take every transition, against the `Api`, and compares each answer with the model's. A change to a rule of the flow changes its model too.
- `grant-store-postgres.test.ts` runs the suite on Postgres when `TEST_DATABASE_URL` names an empty database it may migrate and fill, and is skipped otherwise: CI runs no suite on Postgres, its Database job only checks `db.gen.ts`.
- Test handlers through `HttpApiTest`, with no server. It builds the routes of the whole `Api`, so the test Layer provides every middleware the `Api` declares: copy `modules/todos/http/todos-handlers.test.ts`.
- A client that keeps cookies: `makeBrowser` in `modules/identity/http/identity-handlers.test.ts`.
- Test on the assembled `Routes` (`server.test.ts`) what `HttpApiTest` cannot see: the docs, CORS, an endpoint that reads the cookie without declaring `Authentication` (`signOut`), and anything that reads `X-Forwarded-For`.
