<img src="assets/icon.svg" width="64" height="64" alt="">

# quack-starter

A starting point for TypeScript web applications.

- **Front end**: [TanStack Start](https://tanstack.com/start), React 19, Tailwind v4, [ui-sdk](https://ui-sdk.dev)
- **Back end**: [Effect](https://effect.website) v4 with `HttpApi`, on Node.js
- **Monorepo**: pnpm workspaces and [Vite+](https://viteplus.dev) (task runner with cache, lint, format, test)
- **Types end to end**: the server and the web client are both derived from one API definition in `packages/contracts`
- **Architecture**: bounded contexts with domain, application, infrastructure, and HTTP layers, enforced by lint

## Requirements

- Node.js 26 (see `.node-version`)
- pnpm 12
- [Vite+](https://viteplus.dev) (`vp`), which can also manage Node.js and pnpm for you
- Docker (Docker Desktop or OrbStack), running: the server stores its data in PostgreSQL and sends its mail to Mailpit, both of which `pnpm dev` starts

## Getting started

```sh
pnpm install
cp .env.example .env
pnpm dev
```

`pnpm dev` starts PostgreSQL from `compose.yaml` (`portless compose up -d --wait`, or `docker compose up -d --wait` with `PORTLESS=0`), on `127.0.0.1:54320`, creates the database when missing, and starts the server on it. Every checkout shares this one container and, by default, the database `quack`. A checkout whose branch has migration files that `origin/HEAD` (as known locally, no fetch) does not gets a database of its own instead, `quack_<branch>` (the branch slugged, `feat/postgres-database` gives `quack_feat_postgres_database`, cut at 63 characters; the folder's name on a detached HEAD), so `quack` only receives the migrations of the default branch. `DEV_DATABASE=own`, in the shell or the checkout's `.env`, gives a checkout its own database whatever its branch. A database of its own starts empty, never copied from `quack`. A checkout behind its database (it records a migration the branch lacks) starts with a warning; one that has diverged from it (a recorded migration has the id of a file of the branch, with another name) does not start, and the message names the id. A `DATABASE_URL` set in the shell or in `.env` wins: `pnpm dev` then starts no container and uses it as given. The server brings the database's schema up to date at startup, and does not start when Postgres is unreachable. `docker compose down -v` wipes every dev database: the data lives in the `quack-postgres` volume until then. `pnpm db:rollback` reverts the latest migration, `pnpm db:rollback --to <id>` every one above that id. `pnpm db:seed` resets the database to a known state: it migrates, empties every table, and seeds the dev data again, whatever the database held; it refuses any `DATABASE_URL` whose host is not `localhost` or `127.0.0.1`. `pnpm dev` seeds a database that records no migration: one it has just created, or rolled back to 0.

Mail the server sends in dev goes to [Mailpit](https://mailpit.axllent.org), which `pnpm dev` starts from `compose.yaml` with Postgres, shared by every checkout: its inbox is at https://mailpit.quack.localhost (http://localhost:8025 with `PORTLESS=0`), and it listens for SMTP on `127.0.0.1:10250`. Start the containers through portless: a plain `docker compose up` gives the inbox back its port 8025. With `DATABASE_URL` set, which starts no container, start Mailpit with `pnpm exec portless compose up -d mailpit`, or set `SMTP_URL`. Links in a mail start from `PUBLIC_URL`, so they point at the checkout's own web app. In production, set `SMTP_URL` and `MAIL_FROM` (`.env.example`).

`pnpm dev` runs both apps under [portless](https://portless.sh), so they take a free port each and several checkouts run side by side. The web app is at https://quack.localhost and the API at https://api.quack.localhost. In a git worktree, the branch prefixes both: https://my-branch.quack.localhost. The browser only calls the web app: it relays `/api` and `/.well-known` to the API, so both share one origin, which `pnpm dev` gives the API as `PUBLIC_URL`. API docs are served at https://quack.localhost/api/docs. Users, their Sessions, and Todos live in Postgres, so a restart signs no one out. The seed creates Users, among them `user@quack.dev` and `admin@quack.dev` (password `quack-password`), as whom the sign-in page signs in in one click in dev, each with a few Todos. `pnpm db:seed` brings them back.

The portless proxy listens on port 443, which needs `sudo`, and `pnpm dev` has no terminal to ask for it. Start the proxy once, before `pnpm dev`:

```sh
pnpm exec portless proxy start            # https://quack.localhost, asks for sudo
pnpm exec portless service install        # or start it with the system instead
pnpm exec portless proxy start --port 1355 # or no sudo: https://quack.localhost:1355
```

The first start adds a local certificate authority to the system trust store. `pnpm exec portless doctor` says why a URL does not load.

`PORTLESS=0 pnpm dev` runs the apps without portless: the web app on http://localhost:3000, the API on http://localhost:3001, reached through `API_URL`, with `PUBLIC_URL` from `.env`. `pnpm dev:emails` previews the emails at https://emails.quack.localhost (`pnpm exec portless get emails.quack` in a worktree), or on http://localhost:3002 with `PORTLESS=0`.

## Connect an AI Client

Quack serves its API to AI Clients over MCP at `<PUBLIC_URL>/api/mcp`: https://quack.localhost/api/mcp under portless (`pnpm exec portless get quack` gives the origin in a worktree). The AI Client sends the User to Quack's consent page, and then acts as them with the Permissions they approved. How it works: [docs/ai-clients.md](docs/ai-clients.md).

- **Claude**: in Settings, Connectors, add a custom connector with the MCP URL. claude.ai reaches it from the internet, so the URL must be public: a dev server on `quack.localhost` is out of its reach.
- **Claude Code**: `claude mcp add --transport http quack https://quack.localhost/api/mcp`, then `/mcp` in a session to sign in and approve. Node must trust portless's certificate authority: if the connection fails on the certificate, start Claude Code with `NODE_EXTRA_CA_CERTS` pointing at it.
- **MCP Inspector**: `npx @modelcontextprotocol/inspector`, with the transport Streamable HTTP, the MCP URL, and the connection type Via Proxy: `/api/mcp` refuses a page of another origin. Its document is served over http from this machine, which `AI_CLIENT_LOOPBACK_HTTP=true` (in `.env.example`) allows.

AI Clients that only register through Dynamic Client Registration, such as Cursor, cannot connect (ADR 0004).

## Logs and traces

The server writes its logs to the console, readable in dev. In production, set `LOG_FORMAT=json` for one JSON line per entry. With `OTEL_EXPORTER_OTLP_ENDPOINT` set, it also sends its logs and traces over OTLP/HTTP to that collector, of any vendor (`docs/adr/0003-telemetry-through-effect-otlp-exporters.md`).

`pnpm dev:telemetry` is `pnpm dev` with them: it starts Grafana's `otel-lgtm` container through `portless compose` and points the server at it. Grafana is at https://telemetry.quack.localhost, where Explore shows the traces (Tempo) and the logs (Loki) of `quack-server`; it receives OTLP at https://4318.telemetry.quack.localhost. Every checkout sends to this one container, which keeps running after `pnpm dev:telemetry` stops: `pnpm exec portless compose --profile observability down otel-lgtm` stops it.

## Commands

| Command              | What it does                                                    |
| -------------------- | --------------------------------------------------------------- |
| `pnpm dev`           | Run the web app and the server, under portless                  |
| `pnpm dev:telemetry` | `pnpm dev`, with Grafana receiving the server's logs and traces |
| `pnpm dev:emails`    | Preview the emails, under portless                              |
| `pnpm check`         | Format check and lint                                           |
| `pnpm fmt`           | Format                                                          |
| `pnpm typecheck`     | Typecheck every package with `tsc`                              |
| `pnpm typecheck:ci`  | Typecheck every package with `tsrs`, as CI does                 |
| `pnpm test`          | Run the tests                                                   |
| `pnpm fallow`        | Find unused code, duplicates, and complex functions             |
| `pnpm build`         | Build the apps                                                  |

Typecheck, test, and build are cached per package: a task whose inputs did not change is replayed.

## Structure

```
apps/
  server/         Effect HTTP API
  web/            TanStack Start app
packages/
  contracts/      Schemas and the API definition shared by both apps
  ui/             ui-sdk components and the Tailwind theme
  form/           Form hook and its components: TanStack Form, validated by Effect schemas
  emails/         The emails Quack sends, written with React Email
  oxlint-plugin/  Lint rules: no relative imports, module boundaries, no sql.unsafe outside migrations
docs/adr/         Architecture decisions
```

The architecture and its rules are described in [AGENTS.md](AGENTS.md), which is written for coding agents and people alike.

## Using this template

1. Rebrand the app in `packages/brand`: its names, logo, icon, font, and colors. Then replace the `@quack` scope and the other `quack` names (the API's in `packages/contracts/src/api.ts`, which imports no other package) with your own.
2. Replace the `todos` example context everywhere (`packages/contracts/src/todos`, `apps/server/src/modules/todos`, `apps/web/src/features/todos`).
3. Swap the in-memory repository for a real one by providing another Layer in `apps/server/src/main.ts`.
