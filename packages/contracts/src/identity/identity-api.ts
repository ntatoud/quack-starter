import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import { EmailAlreadyTaken } from "#/identity/identity-errors.ts";
import { Email, Password, User } from "#/identity/user.ts";

export class IdentityApi extends HttpApiGroup.make("identity").add(
  // Answers with the User and sets the session cookie: a visitor is signed in as soon as they sign up.
  HttpApiEndpoint.post("signUp", "/sign-up", {
    payload: Schema.Struct({ email: Email, password: Password }),
    success: User,
    error: EmailAlreadyTaken.pipe(HttpApiSchema.status(409)),
  }),
  HttpApiEndpoint.get("me", "/me", {
    success: User,
  }).middleware(Authentication),
) {}
