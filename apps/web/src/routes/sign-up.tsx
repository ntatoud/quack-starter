import { createFileRoute } from "@tanstack/react-router";

import { SignUpCard } from "#/features/identity/sign-up-card.tsx";

export const Route = createFileRoute("/sign-up")({ component: SignUpCard });
