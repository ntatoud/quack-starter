# Contributing

1. Install with `pnpm install`. This also installs the pre-commit hook, which formats and lints staged files.
2. Branch from `main`.
3. Before opening a pull request, run:

   ```sh
   pnpm check
   pnpm typecheck
   pnpm test
   pnpm knip
   ```

4. Use a [conventional commit](https://www.conventionalcommits.org) title, such as `fix(web): the todo form keeps its draft on error`.
5. Keep a pull request to one problem. CI must pass.

The architecture rules are in [AGENTS.md](AGENTS.md).
