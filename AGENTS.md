# AGENTS.md

A starter for TypeScript web apps: TanStack Start + ui-sdk on the front, Effect v4 on the back, in a pnpm + Vite+ (`vp`) monorepo. The words of the domain are defined in `GLOSSARY.md`: use them as defined.

Read the guide of the part you change before you change it:

- `apps/server/AGENTS.md`: the API, its modules, the database, the server's tests.
- `apps/web/AGENTS.md`: routes, pages, calls to the API, tables, forms.
- `packages/form/AGENTS.md`: a new control for `@quack/form`.
- `packages/ui/AGENTS.md`: a component, built on ui-sdk.

## Commands

Work is done when `pnpm check`, `pnpm typecheck`, `pnpm test`, and `pnpm fallow` pass, from the repo root. `pnpm fmt` fixes formatting.

One package: `vp run --filter @quack/server test`. One file: `vp test run src/path/file.test.ts` from the package.

`pnpm dev` needs the portless proxy already running (README). `pnpm exec portless get quack` gives the URL of the web app, which changes with the branch in a worktree.

## Packages

```
apps/server             Effect HTTP API (Node)
apps/web                TanStack Start app
packages/brand          The brand: names, logo, icon, font, and colors of the theme
packages/contracts      Schemas and the HttpApi definition, shared by the server and the web app
packages/ui             Components built on ui-sdk, and the Tailwind theme
packages/form           Form hook and its components: TanStack Form, validated by Effect schemas
packages/ui-state       UiState: what a screen shows while data loads, one case per state
packages/effect-query   TanStack Query options from Effects
packages/oxlint-plugin  Lint rules of this repo
```

The server serves `/api` and `/.well-known`, and the web app relays both to it (`lib/api-relay.ts`): the browser and AI Clients see one origin, `PUBLIC_URL`.

Packages import each other's TypeScript sources through `exports`, by file path, with no barrel and no build step: `@quack/contracts/todos/todo`, `@quack/ui/components/button`.

The brand lives in `packages/brand` only: the app's names in `brand.ts`, its `Logo`, the icon of the browser tab (`icon.ts`), and the font, radius, and colors of the theme in `theme.css`, which `@quack/ui/globals.css` imports. Read the name from `brand`, never write it in a page; to rebrand the app, change that package. Contracts stay out of it, as of any `@quack` package.

A component of `packages/ui` is built on ui-sdk, and exposes its parts and props: to add one, follow `packages/ui/AGENTS.md`. Restyle it for one screen with `className` or composition.

## Contracts

The server implements `Api` (`packages/contracts/src/api.ts`) and the web app derives its client from it. A context has a folder: its schemas, its tagged errors, and its `HttpApiGroup` (`*-api.ts`), added to `api.ts`.

- Contracts hold data and its validation; behavior stays in the server's domain.
- `Api` adds the `/api` prefix: a group declares `/todos`.
- Set an HTTP status on the endpoint (`HttpApiSchema.status(404)` on the error in `*-api.ts`), not on the error class.
- Protect endpoints with `.middleware(Authentication)`, declared after the endpoints it covers: it skips the ones added later.
- Every endpoint behind `Authentication` declares the Permission its caller needs: `.annotate(RequiredPermission, "todos:list")` (`packages/contracts/src/permission.ts`), or `"none"` when any signed-in caller may call it. A context names its Permissions in `<context>-permissions.ts`, added to the `Permission` union. `Authentication` refuses a caller whose Role lacks the Permission with `Forbidden` (403), and every caller of an endpoint that declares nothing, which a test of `Api` catches. Which Role gives which Permission: the identity domain (`apps/server/src/modules/identity/domain/role-permissions.ts`). ADR 0005.
- An endpoint behind `Authentication` becomes an MCP tool for AI Clients when it or its group carries `.annotate(McpTool, {})` (`packages/contracts/src/mcp-tool.ts`), and then needs an `OpenApi.Description`. The server refuses to start on an offered endpoint no tool can stand for, and says why.
- A list that pages, sorts, or filters copies `UserListQuery`. It breaks ties on a unique field, so a page is stable from one request to the next.

## Conventions

- Effect v4: read its docs for agents in `apps/server/node_modules/effect/ai-docs` before writing Effect code, since v4 differs from v3.
- A service is a `Context.Service` class with a static `layer`. Write its methods inline in `Service.of({ ... })` as `Effect.fn("Service.method")`; a helper several methods share stays a local function.
- Errors are `Schema.TaggedError` classes, and code fails with them rather than throwing.
- Import through `#/` (the package's `src`) with the file extension: `#/modules/todos/domain/todo.ts`.
- A comment says why the code is the way it is, or a constraint the code cannot show (a security reason, a browser quirk, a unit). A number a test would explain in a comment becomes an expression (`Duration.toSeconds(sessionLifetime)`).
- A test sits next to its code: `*.test.ts` runs in Node, `*.test.tsx` in a real browser. Effect code uses `@effect/vitest`.
- Tests run shuffled, so each test owns its data: its own email and address, the time read with `DateTime.now`, since the tests of one `layer(...)` share its services and `TestClock`.
- A flaky test gets fixed and a slow CI job gets its cause found, with retries and `timeout-minutes` left as they are.
