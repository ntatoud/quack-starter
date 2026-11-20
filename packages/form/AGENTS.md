# Form package

TanStack Form with the repo's components, validated by Effect schemas. It imports `@quack/ui`; `@quack/ui` knows no form library. Using a form: see `apps/web/AGENTS.md`.

To add a control:

1. Write it in its own file of `src`, named `FormXxx` so it is not taken for the `@quack/ui` component it wraps.
2. Render the control and its errors (`FieldControlError`), not the label, as `FormTextField` does. Take the id, the size, `invalid`, and `describedBy` from `useFieldControl()`, wire them to the control (`aria-invalid`, `aria-describedby`, which names a `field.Description` before the errors), and set the control's `name` to the field's: after a submit that fails validation, `form.Root` focuses the first `aria-invalid` element and reads the errors of the field of that `name`.
3. Register it in `use-app-form.ts` under the short name, which `field.` or `form.` prefixes: `FormTextField` is `field.Text`.
4. Test it in the browser with `vitest-browser-react` and the locators of `vite-plus/test/browser` (`src/form-submit-button.test.tsx`).

A control that picks among options (`field.Select` for a few, `field.Combobox` for many, searched by their label) holds `""` until one is chosen, which Base UI calls `null`. The schema decodes `""` to the literal, or to `null` for a field that may stay empty; `noneLabel` or `clearable` then lets the user empty it again (`src/testing/color-form.tsx`).

A boolean field is a `field.Switch` (`src/testing/toggle-form.tsx`).
