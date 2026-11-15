<img src="assets/icon.svg" width="64" height="64" alt="">

# quack-starter

A starting point for TypeScript web applications.

- **Front end**: [TanStack Start](https://tanstack.com/start), React 19, Tailwind v4, [shadcn/ui](https://ui.shadcn.com)
- **Back end**: [Effect](https://effect.website) v4 with `HttpApi`, on Node.js
- **Monorepo**: pnpm workspaces and [Vite+](https://viteplus.dev) (task runner with cache, lint, format, test)
- **Types end to end**: the server and the web client are both derived from one API definition in `packages/contracts`
- **Architecture**: bounded contexts with domain, application, infrastructure, and HTTP layers, enforced by lint

## Requirements

- Node.js 26 (see `.node-version`)
- pnpm 12
- [Vite+](https://viteplus.dev) (`vp`), which can also manage Node.js and pnpm for you

## Getting started

```sh
pnpm install
cp .env.example .env
pnpm dev
```

`pnpm dev` runs both apps under [portless](https://portless.sh), so they take a free port each and several checkouts run side by side. The web app is at https://quack.localhost and the API at https://api.quack.localhost. In a git worktree, the branch prefixes both: https://my-branch.quack.localhost. The browser only calls the web app: it relays `/api` to the API, so both share one origin. API docs are served at https://quack.localhost/api/docs. The data lives in memory: `pnpm dev` creates Users at each start, `admin@quack.dev` (an admin), `user@quack.dev` and 100 random ones (the same at every start), all with the password `quack-password`. In dev, the sign-in page signs in as `user@quack.dev` or `admin@quack.dev` in one click.

The portless proxy listens on port 443, which needs `sudo`, and `pnpm dev` has no terminal to ask for it. Start the proxy once, before `pnpm dev`:

```sh
pnpm exec portless proxy start            # https://quack.localhost, asks for sudo
pnpm exec portless service install        # or start it with the system instead
pnpm exec portless proxy start --port 1355 # or no sudo: https://quack.localhost:1355
```

The first start adds a local certificate authority to the system trust store. `pnpm exec portless doctor` says why a URL does not load.

`PORTLESS=0 pnpm dev` runs the apps without portless: the web app on http://localhost:3000, the API on http://localhost:3001, reached through `API_URL`.

## Commands

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `pnpm dev`          | Run the web app and the server, under portless  |
| `pnpm check`        | Format check and lint                           |
| `pnpm fmt`          | Format                                          |
| `pnpm typecheck`    | Typecheck every package with `tsc`              |
| `pnpm typecheck:ci` | Typecheck every package with `tsrs`, as CI does |
| `pnpm test`         | Run the tests                                   |
| `pnpm knip`         | Find unused files, exports, and dependencies    |
| `pnpm build`        | Build the apps                                  |

Typecheck, test, and build are cached per package: a task whose inputs did not change is replayed.

## Structure

```
apps/
  server/         Effect HTTP API
  web/            TanStack Start app
packages/
  contracts/      Schemas and the API definition shared by both apps
  ui/             shadcn components and the Tailwind theme
  form/           Form hook and its components: TanStack Form, validated by Effect schemas
  oxlint-plugin/  Lint rules: no relative imports, module boundaries
```

The architecture and its rules are described in [AGENTS.md](AGENTS.md), which is written for coding agents and people alike.

## Using this template

1. Replace the `@quack` scope and the `quack` names with your own.
2. Replace the `todos` example context everywhere (`packages/contracts/src/todos`, `apps/server/src/modules/todos`, `apps/web/src/features/todos`).
3. Swap the in-memory repository for a real one by providing another Layer in the module's `index.ts`.
