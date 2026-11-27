# Can oxcruise enforce module boundaries and where tests may live

Research for ticket #259 (map #257). Date of the research: 2026-11-27. Every claim names its source. "Tried" means I ran it on this repo (commit `90eeb35`, `pnpm install --frozen-lockfile`).

## Answer

- oxcruise exists. It is a Rust dependency-cruiser alternative, 0.3.0, a month old, one author. It can express both rules, and I ran both on this repo.
- "Only through `index.ts`" is the built-in `visibility` rule. It works across `#/` subpath imports and relative imports.
- "A test file only at a tested interface" is best expressed with the `folder-structure` rule, which checks file placement, not imports. Cookout's version (a dependency rule with `to: {}`) is weaker, and oxcruise's translation of it is noisy.
- Fallow, already in `pnpm fallow` and CI, also has a module-boundary check with `publicFiles` (entry files only). Tried: it works. It does not cover tests placement.
- Recommendation: do not add a new dependency yet. See the last section.

## What oxcruise is

| Fact                                                                                                                                        | Source                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| npm `oxcruise@0.3.0`, MIT, no dependencies, 5 versions, published 2 weeks ago by GitHub Actions (OIDC)                                      | `npm view oxcruise`                                        |
| Repo `greeeg/oxcruise`, created 2026-10-27, last push 2026-11-09, 10 stars, one contributor, 0 open issues                                  | `gh api repos/greeeg/oxcruise` and `/contributors`         |
| "A dependency-cruiser alternative built on the oxc toolchain", Rust core with a napi addon, Node 22.18 or later                             | `README.md` of the repo                                    |
| Config: `oxcruise.config.ts` (`defineConfig`) or `.oxcruiserc.json` with a `$schema`. Globs only, `!` negation, `{name}` captures           | `README.md`, `website/src/pages/reference/config.mdx`      |
| Exit codes: 0 clean, 1 errors, 2 bad flag or config. `-f github` prints annotations for GitHub Actions. `--deny-warnings`, `--max-warnings` | `README.md`, `reference/cli.mdx`                           |
| Plugins in TypeScript that see the finished graph, and a programmatic `cruise()` API for architecture tests                                 | `README.md`, `features/js-plugins.mdx`                     |
| Tested against dependency-cruiser 18.7 for graph conformance (modules and edges), not for violations                                        | `guide/migrate-from-dependency-cruiser.mdx`, "Conformance" |

Maturity: very young. Rules were renamed in 0.2.0 (`Add folder rules, rename every rule`, 2026-11-05) and rule entries became objects with a `level` in the same release, so expect breaking changes at every 0.x. Not the OXC organization's tool; an independent project that borrows the toolchain.

## The two rules

### Only through `index.ts`: `visibility`

The `visibility` rule (category `restriction`, off by default) does this directly (`reference/rules/visibility.mdx`):

```json
{
  "rules": {
    "visibility": {
      "level": "error",
      "folders": [
        {
          "path": "apps/server/src/modules/{m}",
          "public": "index.ts",
          "message": "Import a module through its index.ts."
        }
      ]
    }
  }
}
```

Tried on `apps/server/src`: 21 violations, all real. They are the memory adapters that `src/mcp/contract-tools.test.ts` and `src/server.test.ts` import from `modules/*/testing/` (cookout's own rule has the same exclusion for `tests/` folders, and these go away in the deep-modules refactor). The rule needs no `$1` back-reference: the `{m}` capture and "inside the folder" semantics give "same module is allowed". The generic cookout rule `entry-points-only-from-app` (anything outside `modules/` also goes through the entry) is the same rule, since `visibility` checks "outside the folder", not "outside the sibling modules".

Cookout's rule, for reference (`gh api repos/mattpocock/cookout/contents/.dependency-cruiser.cjs`):

```js
{ from: { path: `^${R}/([^/]+)/`, pathNot: TESTS },
  name: "entry-points-only-across-modules",
  to: { path: INTERNALS, pathNot: `^${R}/$1/` } }
```

with `INTERNALS = ^app/modules/[^/]+/[^/]+/`. Note a difference: cookout's INTERNALS matches only files in a subfolder of a module (`modules/x/y/...`), so a flat file `modules/x/foo.ts` is public there. Quack's standing decision is "`index.ts` as its only entry point, flat internal files", so the oxcruise form (`public: "index.ts"`) is the correct one for Quack and cookout's regex would need `[^/]+\.ts` minus `index.ts` instead.

### Test files only at a tested interface

Cookout's rule (same file) is:

```js
{ from: { path: "\\.test\\.tsx?$",
          pathNot: [`^${R}/(${TESTED_INTERFACES.join("|")})/tests/`, ...] },
  name: "tests-only-at-tested-interfaces", to: {} }
```

This is a dependency rule: it fires on every outgoing dependency of a stray test file. Two weaknesses, both inherited by any tool that copies it: a test file with no import is not flagged (rare), and the error is one per import, not one per file.

Tried as an oxcruise `forbid` rule (`from: ["**/*.test.{ts,tsx}", "!apps/server/src/server.test.ts"], to: {}`): it works but reports one error per import, 265 errors for the 40 stray tests. Usable, noisy.

Better: the `folder-structure` rule works on files and reports one error per file. Tried:

```json
{
  "folder-structure": {
    "level": "error",
    "folders": [
      {
        "path": [
          "apps/server/src/**/*.test.ts",
          "!apps/server/src/server.test.ts",
          "!apps/server/src/modules/*/tests/*"
        ],
        "allow": ["!*.test.ts"],
        "message": "A test file lives at a tested interface only."
      }
    ]
  }
}
```

Result: 39 errors, one per stray test file; the excluded `server.test.ts` was not reported. The allowlist (the "short list" of the map) is the `!` globs in `path`. I did not verify a negation that excludes a folder (as opposed to a file glob); use file globs. For the `*.test.tsx` browser tests of `apps/web` and `packages/ui` add a second `path` pattern.

Note that "tested interface" is a judgement oxcruise cannot make: it only checks a path pattern. The allowlist is the definition, as in cookout (`TESTED_INTERFACES`).

### Across the pnpm workspace

- Workspace discovery: from `pnpm-workspace.yaml`; each file uses the nearest `tsconfig.json`; a workspace package name is an alias to that package (`guide/monorepos.mdx`).
- `#/*` subpath imports (`"imports": {"#/*": "./src/*"}` in each package.json): resolved. Tried: the 21 violations above arrive through `#/modules/...` specifiers.
- Packages by `exports` file path (`"exports": {"./*": "./src/*.ts"}`): resolved. Tried: `@quack/effect-kysely/kysely` resolved to `packages/effect-kysely/src/kysely.ts`. The docs suggest `resolve.conditions: ["source"]` for source-pointing exports; Quack's exports have no condition, so none was needed.
- One run from the repo root with `entries: ["apps", "packages"]` sees the whole graph. Nested configs are not discovered (`--cwd` per package, `extends` for sharing).
- Without `pnpm install` the default rules give 469 false errors (unresolved npm packages). Run it after install, as CI does.

## Running it next to `vp`

- Not part of `vp check`: that runs `vp fmt` and `vp lint` (oxlint, with `@quack/oxlint-plugin` as a JS plugin) per `package.json` and `vite.config.ts`. oxcruise is a separate binary, so it is a new script (`"cruise": "oxcruise"`), a new step in `.github/workflows/ci.yml` next to `vp run -w fallow`, and a new entry in the "work is done when" list of `AGENTS.md`. `pnpm check` would have to become `vp check && oxcruise` to include it. This is the main cost, and it has no integration with Vite+.
- Speed: tried on `apps/server/src`, "finished in 38ms on 8 thread(s)", 0.4 s wall with process start (224 modules, 973 dependencies). Fallow on the whole repo with a boundary config: 1.2 s wall. The existing oxlint rule is comparable or faster per file, since it reads no graph.
- dependency-cruiser 18.9.0 was not timed: it refuses to run here because its TypeScript parser needs `typescript` below 7 ("typescript@7.0 is not supported as its API lacks what dependency-cruiser needs"), or the `swc` parser with `@swc/core` (cookout's config sets `parser: "swc"`). The latest `typescript` on npm is 7 (the error came from a scratch install of it); this repo typechecks with `@effect/tsgo`, so dependency-cruiser would need `@swc/core` added and its `exoticRequireStrings` and `enhancedResolveOptions.conditionNames` configured, as cookout does.

## What dependency-cruiser offers that oxcruise lacks

Sources: `guide/migrate-from-dependency-cruiser.mdx` ("What maps"), dependency-cruiser's npm metadata.

- Maturity: 2016, 7477 stars, latest push 2026-11-25, 18.9.0. oxcruise is one month old with a single maintainer.
- Rule conditions oxcruise drops on migration: `required`, `allowed` (allow-list mode), `numberOfDependents{Less,More}Than`, `moreUnstable`, `ancestor`, `license`, `scope: "folder"`, `to.dependencyTypes` as a free filter. Some have a built-in rule replacement; `numberOfDependents`, `moreUnstable`, `license` and `ancestor` need a JS plugin.
- Regex patterns with back-references (`$1`) versus oxcruise globs with `{name}` captures. Equivalent for these rules, but cookout's `.dependency-cruiser.cjs` is not reusable as is: `--migrate` converts only common regex shapes and drops the rest with a warning (`\d`, look-around, quantified groups). Cookout's rules use `(...)` alternation and `[^/]+`, which convert, but its `exoticRequireStrings` function (hashing the lockfile) does not.
- Output formats: dependency-cruiser has `dot`, `mermaid`, `archi`, `err-html` and more; oxcruise has `default`, `long`, `json`, `github`, `text` and an interactive `--visualize` site.
- Ecosystem: `knownViolations` baselines, a cache, webpack and babel config reading. Dropped by oxcruise.

What oxcruise has that dependency-cruiser does not: speed (parallel Rust), no `typescript` peer dependency (matters with TS 7 here), the `folder-structure` rule (file placement), unused exports, files and packages (overlaps with fallow), ignore comments (`// oxcruise-ignore-next-line <rule> -- reason`).

## Alternatives already in the repo

### Fallow boundaries (tried)

`pnpm fallow` already runs in CI (`.github/workflows/ci.yml`, step "Unused code, duplication, and complexity"). Its schema (`node_modules/fallow/schema.json`, `BoundaryZone`) has `publicFiles`: "a file of another zone may import a file of this zone only through a file that is in this zone and matches a glob". With `autoDiscover` each folder of `modules/` becomes its own zone. Tried with a temporary config:

```jsonc
"boundaries": { "zones": [{ "name": "modules", "patterns": [],
  "autoDiscover": ["apps/server/src/modules"], "publicFiles": ["index.ts"] }], "rules": [] }
```

Result: 5 `boundary_violations` of reason `internal_file`, between modules (for example `identity/http/authentication-middleware.test.ts` into `transaction/testing/transaction-memory.ts`). The 16 violations that oxcruise reports from outside the modules (`src/mcp/`, `src/server.test.ts`) do not appear, because those files belong to no zone; they would need a zone of their own (`coverage.requireAllFiles` exists for that). Fallow `rules` between zones can express the layer rules. No file-placement rule for tests: its rule packs have `banned-import`, `banned-call` and `banned-export` (`rule-pack-schema.json`), which are import-based like cookout's.

### The repo's own oxlint plugin

`packages/oxlint-plugin/src/rules/module-boundaries.ts` runs inside `vp check`, per file, with no graph. It already implements "through `index.ts`" for the layered shape (`layerImportMessage`) and resolves `#/` and relative specifiers by hand. Removing the layer rules leaves about 30 lines: resolve the specifier, find `modules/<name>/`, report when the target is not `index.ts` and the module differs. Its weakness: it resolves only `#/` and relative specifiers (not `@quack/*`, which is not needed for the modules rule), and it has no notion of "a test file's location": a per-file rule can do that too (`context.filename`), with no import needed, which is the better semantics than cookout's.

## Recommendation

1. Rewrite `quack/module-boundaries` as a small "only through `index.ts`" rule, plus a "test files only at tested interfaces" rule (one error per file, from `context.filename`, with a short allowlist in the rule or in the config). Both stay inside `vp check`, so `pnpm check` and `pnpm fmt`-style editor feedback keep one entry point, with no new dependency and no new CI step. Cost: the repo owns the code (already true, with tests next to it).
2. If the map prefers a graph tool: use fallow `boundaries` with `publicFiles` for the modules rule, since it is already in CI, and add zones for `mcp` and the rest of `src` so the 16 outside imports are seen. Do not add a second graph tool for one rule.
3. Do not adopt oxcruise yet. It does the job (both rules ran), it is fast, and its `visibility` and `folder-structure` rules fit these two rules better than cookout's regexes do. But it is a one-month-old, single-maintainer 0.x project with renamed rules, it does not run under `vp check`, and fallow already covers the boundary. Revisit when it reaches 1.0 or when a rule needs the whole graph (cycles by folder, reachability) that the oxlint rule and fallow cannot give.
4. Whichever tool: express the tests rule as file placement, not as a dependency of the test file. Cookout's `to: {}` form misses an import-free test and reports once per import.

## Not verified

- dependency-cruiser's run time on this repo (it needs `@swc/core` here; not installed).
- oxcruise behaviour on `apps/web` and `packages/*` (only `apps/server/src` was run for the rules; the whole-repo graph resolution was seen through `@quack/effect-kysely` only).
- Whether a `!` negation of a folder (not a file) works in `folder-structure` paths: an attempt did not exclude the folder; file globs did work.
- Whether oxcruise's `--visualize` and plugin API are stable across 0.x versions.
