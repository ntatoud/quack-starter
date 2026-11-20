# Form package

TanStack Form with the repo's components, validated by Effect schemas. It imports `@quack/ui`; `@quack/ui` knows no form library. Using a form: see `apps/web/AGENTS.md`.

To add a control:

1. Write it in its own file of `src`, named `FormXxx` so it is not taken for the `@quack/ui` component it wraps.
2. Render the control and its errors, not the label, as `FormTextField` does. Take the id and size from `useFormFieldLayout()`, wire the error to the control (`aria-describedby`, `aria-invalid`), and set the control's `name` to the field's: after a submit that fails validation, `form.Root` focuses the first `aria-invalid` element and reads the errors of the field of that `name`.
3. Register it in `use-app-form.ts` under the short name, which `field.` or `form.` prefixes: `FormTextField` is `field.Text`.
4. Test it in the browser with `vitest-browser-react` and the locators of `vite-plus/test/browser` (`src/form-submit-button.test.tsx`).
