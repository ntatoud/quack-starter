import { createFileRoute } from "@tanstack/react-router";

import { SignUpPage } from "#/features/identity/sign-up-page.tsx";

export const Route = createFileRoute("/sign-up")({ component: SignUpPage });
