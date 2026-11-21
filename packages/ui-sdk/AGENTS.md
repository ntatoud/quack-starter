# AGENTS.md

Components built on ui-sdk (`@ui-sdk/react`, `@ui-sdk/core`).

Before using ui-sdk, follow the `ui-sdk` skill if it is installed, and read `node_modules/@ui-sdk/react/docs/llms.txt`. To build a new component, also search `node_modules/@ui-sdk/react/docs/core.md` by heading, and read `rendering.md` next to it.

A component takes the look of `@quack/ui`: pass that package's part to `render` (`src/search-field.tsx`). ui-sdk keeps its own `data-slot` on a part, so a `@quack/ui` selector keyed on another slot, like a focus ring, needs a class of its own. Tests run in the browser, as in `@quack/ui`.
