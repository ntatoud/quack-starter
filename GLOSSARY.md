# Quack

A starter app where people sign up, sign in, and manage their own todos.

## Identity

**User**:
A person who has signed up, identified by their email and proving it with a password.
_Avoid_: Account, member, customer

**Session**:
The proof that a User has signed in, valid until they sign out or it expires.
_Avoid_: Token, login

**Current User**:
The User whose Session made the request being handled.
_Avoid_: Viewer, logged-in user, me

**Role**:
What a User is allowed to do: `user` or `admin`.
_Avoid_: Permission, group, profile

## Todos

**Todo**:
A task a User wants to get done, with a title and a completed state.
_Avoid_: Task, item

**Owner**:
The User who created a Todo and the only one who sees it.
_Avoid_: Author, creator
