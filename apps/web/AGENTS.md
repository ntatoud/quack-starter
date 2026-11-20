# Web

TanStack Start app. It depends on `@quack/contracts`, never on the server.

## Routes and pages

- A route file in `routes/` declares its route (`createFileRoute`, `beforeLoad`, `head`, `validateSearch`) and names its components. Every component lives in `features/<context>/`, the page included, and reads the router with `useNavigate()` and `useRouteContext({ from })`. A component no feature owns that needs the router goes in `components/`.
- Every route sets its title in `head`: `pageTitle("Todos")`, segments from the most specific (`features/layout/page-title.ts`).
- Validate a route's search with an Effect schema: `validateSearch: Schema.toStandardSchemaV1(SignInSearch)`.
- Pages of every Current User go under `routes/_authenticated/app/`, pages of Admins only under `routes/_authenticated/admin/`, with their components in the `admin/` folder of their feature. Add the page to the sidebar of its root (`features/layout`).
- A page renders its own top bar, `PageHeader`, with its `title` (the `h1`) after the `trail` of pages that lead to it and `back` for a page reached from another, such as a page of settings: copy `features/todos/todos-page.tsx`.
- While the Current User is not onboarded (`currentUser.onboardedAt === null`), `AuthenticatedLayout` covers every page under `_authenticated` with `OnboardingDialog`, which cannot be closed (`features/onboarding`).
- The settings of the Current User are pages of `routes/_authenticated/app/settings/`, linked from the user menu. Lay one out with `SettingsCard` (`@quack/ui/components/settings-card`): copy `features/profile/profile-form.tsx`.
- Pages for visitors only go under `routes/_guest/` and redirect a Current User in their `beforeLoad`.
- Read a `redirect` search param through `redirectTarget` (`features/identity/redirect-target.ts`): it comes from a link anyone can write.
- A link that looks like a button is a `ButtonLink` (`components/button-link.tsx`).
- `src/routeTree.gen.ts` is generated: commit it as generated.

## Data

- Call the API with the query options of `api` (`lib/api.ts`): `useQuery(api.todos.list.queryOptions())`, `useMutation(api.todos.create.mutationOptions())`.
- Render a query through `matchQuery(query, { Pending, Error, Success })` (`@quack/ui-state/query`). Anything else that loads answers a `UiState`, matched with `UiState.match`.
- Load data in the browser: in the server render, the API client has no cookie. The one exception is the Current User, which every route gets as `context.currentUser` (`null` for a visitor, never under `_authenticated`).
- A Preference belongs to the device, not to the User: it stays the same when another User signs in on it, and applies to visitors too. Declare it with `definePreference(schema, default)` under a kebab-case key of `Preferences` (`features/preferences/preferences.ts`); read it with `usePreference(key)` and save them with `useSavePreferences()`. They are kept by a `PreferencesStore` (`features/preferences/preferences-store.ts`), which the router gives to the root route, which reads them before the first render, and to the components; only `cookiePreferencesStore` knows it is a cookie. A stored value that no longer decodes is its default, so a Preference changes with no migration.
- A test of a component that reads a Preference renders it in the `Providers` of `testProviders(preferences)` (`testing/test-providers.tsx`), over a store in memory.
- After a call that changes who the Current User is, call `useSetCurrentUser()` with the User, or `null` after a sign-out.
- After a call that changes the Current User's own data (their Profile), call `useUpdateCurrentUser()` with the User: it keeps the other queries, since the User is the same.
- A call that fails with `Unauthenticated` needs no handling where it is made: `router.tsx` leads to the sign-in page.
- A web server variable goes in `env/server.ts`, without a `VITE_` prefix. Vite does not load it from `.env`: pass it by name in `vite.config.ts`, as `API_URL` is.

## Tables

A table keeps its whole state in the URL, and the API sorts, filters, and pages it. Copy `features/users/admin/users-list.tsx` and the `validateSearch` of its route.

## Forms

Build a form with `useAppForm` from `@quack/form/use-app-form`: copy `features/todos/todos-form.tsx`.

- Validation does not transform the values, so decode them in `onSubmit` with the schema given to `schemaFormOptions`.
- When the request of `onSubmit` fails, throw `new SubmitFailed(message)`. Any other error thrown is reported as a bug.
- A control without a `field.Label` takes an `aria-label`.
- Test a form in the browser with `fetch` stubbed (`features/todos/todos-form.test.tsx`), asserting what a user or assistive tech gets: focus, accessible name and description, the live region.
