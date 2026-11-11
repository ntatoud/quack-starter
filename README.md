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

The web app runs on http://localhost:3000 and the API on http://localhost:3001. API docs are served at http://localhost:3001/docs.

## Commands

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `pnpm dev`          | Run the web app and the server                  |
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
  oxlint-plugin/  Lint rules: no relative imports, module boundaries
```

The architecture and its rules are described in [AGENTS.md](AGENTS.md), which is written for coding agents and people alike.

## Using this template

1. Replace the `@quack` scope and the `quack` names with your own.
2. Replace the `todos` example context everywhere (`packages/contracts/src/todos`, `apps/server/src/modules/todos`, `apps/web/src/features/todos`).
3. Swap the in-memory repository for a real one by providing another Layer in the module's `index.ts`.
