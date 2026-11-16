# Quack

A starter app where people sign up, sign in, and manage their own todos.

## Identity

**User**:
A person who has signed up, identified by their email and proving it with a password.
_Avoid_: Account, member, customer

**Session**:
The proof that a User has signed in, valid until they sign out or it expires. A request extends a Session that is close to its expiry.
_Avoid_: Token, login

**Current User**:
The User whose Session made the request being handled.
_Avoid_: Viewer, logged-in user, me

**Role**:
What a User is allowed to do: `user` or `admin`.
_Avoid_: Permission, group, profile

**Status**:
Whether a User can sign in: `active`, `invited` (added, but has not chosen a password yet), or `suspended` (refused by an Admin). Only an `active` User signs in, and a Session of a User who is no longer `active` ends at its next request.
_Avoid_: State, enabled, banned

**Admin**:
A User whose Role is `admin`. Only an Admin sees the list of Users; any other Current User is forbidden from it.
_Avoid_: Superuser, staff

## Todos

**Todo**:
A task a User wants to get done, with a title and a completed state.
_Avoid_: Task, item

**Owner**:
The User who created a Todo and the only one who sees it.
_Avoid_: Author, creator
