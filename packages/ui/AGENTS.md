# UI package

The components of the repo and the Tailwind theme (`src/styles/globals.css`). A component is built on ui-sdk (`@ui-sdk/react`, `@ui-sdk/core`), with the look of the theme.

Before using ui-sdk, follow the `ui-sdk` skill if it is installed, and read `node_modules/@ui-sdk/react/docs/llms.txt`. To build a new component, also search `node_modules/@ui-sdk/react/docs/core.md` by heading, and read `rendering.md` next to it.

ui-sdk keeps its own `data-slot` on a part, so style a part by that slot and its state attributes (`data-open`, `data-pressed`), read from the rendered DOM. Tests run in the browser (`vitest-browser-react`).

The `shadcn` package stays only for `shadcn/tailwind.css`, which `globals.css` imports: the `data-open`, `data-closed`, `data-checked`, `data-unchecked`, `data-active` variants and the `no-scrollbar` utility. Its CLI is not used, so a component is written by hand, not added with `shadcn add`.
