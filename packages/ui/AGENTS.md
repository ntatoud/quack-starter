# UI package

The components of the repo and the Tailwind theme (`src/styles/globals.css`). The font, radius, and colors the theme draws with come from `@quack/brand/theme.css`: change a color there, not here. A component is built on ui-sdk (`@ui-sdk/react`, `@ui-sdk/core`), with the look of the theme.

Before using ui-sdk, follow the `ui-sdk` skill if it is installed, and read `node_modules/@ui-sdk/react/docs/llms.txt`. To build a new component, also search `node_modules/@ui-sdk/react/docs/core.md` by heading, and read `rendering.md` next to it.

The data-table is one module: a screen imports `DataTable`, `useDataTable` and the parts it composes from `@quack/ui/data-table` (`src/data-table/index.ts`), and its tests sit beside that file and import it too. What `src/data-table/lib/`, `src/lib/` and `src/hooks/` hold is internal, imported through `#/` by the package's own files.

ui-sdk keeps its own `data-slot` on a part, so style a part by that slot and its state attributes (`data-open`, `data-pressed`), read from the rendered DOM. Tests run in the browser (`vitest-browser-react`).

The `shadcn` package stays only for `shadcn/tailwind.css`, which `globals.css` imports: the `data-open`, `data-closed`, `data-checked`, `data-unchecked`, `data-active` variants and the `no-scrollbar` utility. Its CLI is not used, so a component is written by hand, not added with `shadcn add`.

`@shadcn/lint` checks the classes given to a component of this package: no raw Tailwind palette (`bg-amber-500`), no class Tailwind cannot generate, no `className` it cannot read, no inline style but CSS custom properties. A color the theme lacks is added to `packages/brand/src/theme.css` and mapped in `globals.css`.
