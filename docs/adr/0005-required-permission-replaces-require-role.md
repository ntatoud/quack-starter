# 0005: Each endpoint declares a `RequiredPermission`, checked in `Authentication`, in place of `RequireRole`

Accepted, 2026-11-22. Decided in [#55](https://github.com/ntatoud/quack-starter/issues/55), amended by [#169](https://github.com/ntatoud/quack-starter/issues/169); built in [#182](https://github.com/ntatoud/quack-starter/issues/182).

## Context

The Admin's endpoints (`/api/users/*`) were guarded by `RequireRole("admin")`, a middleware declared on the group, and every other endpoint behind `Authentication` let any signed-in User through. AI Clients will act for a User through a Grant that holds only some of that User's Permissions, its OAuth scopes. A Role check cannot express that: the same User may call an endpoint through their Session and be refused it through a Grant. The guard has to name what an endpoint does, not who may call it.

## Decision

- Each context names its Permissions in the contract (`todos:list`, `todos:write`, `todos:delete`; `users:list`, `users:read`, `users:write`, `users:delete`), and `packages/contracts/src/permission.ts` gathers them into the `Permission` union.
- Each endpoint behind `Authentication` carries a `RequiredPermission` annotation, on the endpoint itself: no default for a group, so adding an endpoint means choosing its Permission. `"none"` declares that any signed-in caller may call it (`me`, and the Current User's own Profile and onboarding).
- The `Authentication` middleware checks it right after it finds the Current User, from the `endpoint` it receives for each request. A caller without the Permission gets `Forbidden` (403), naming the Permission. A Todo of another Owner still answers 404: that is ownership, checked by the repository, not Permission.
- It fails closed: an endpoint behind `Authentication` that declares nothing answers 403 to everyone, Admin included, and a test that reflects `Api` fails on such an endpoint.
- Which Role gives which Permission is behavior, so it lives in the server's identity domain: `admin` has every Permission, `user` the `todos:*` ones. The web app does not learn the Permissions; it keeps reading `role` from the User for `/admin`.
- `RequireRole` is removed: one guard, in one place.

## Consequences

- A Grant's caller will be checked by the same code, with the Grant's Permissions that the Role still gives in place of the Role's.
- A new Role is a new entry in the identity domain's map, with no change to the contract.
- Forgetting the annotation breaks a test and refuses every call, rather than opening the endpoint.
