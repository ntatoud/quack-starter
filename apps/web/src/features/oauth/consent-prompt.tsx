import type { User } from "@quack/contracts/identity/user";
import type {
  AuthorizationRequest,
  AuthorizationRequestParams,
} from "@quack/contracts/oauth/authorization-request";
import { Button } from "@quack/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@quack/ui/components/empty";
import { Skeleton } from "@quack/ui/components/skeleton";
import { matchQuery } from "@quack/ui-state/query";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, TriangleAlertIcon } from "lucide-react";

import { authorizationCheckOptions } from "#/features/oauth/authorization-check.ts";
import { consentSentence } from "#/features/oauth/consent-sentence.ts";
import { userLabel } from "#/features/users/full-name.ts";
import { api } from "#/lib/api.ts";

export interface ConsentPromptProps {
  readonly params: AuthorizationRequestParams;
  readonly currentUser: typeof User.Encoded;
  readonly onRedirect: (url: string) => void;
  readonly onSwitchAccount: () => void;
}

// Stable, so React calls it once, as the sentence mounts: read first by a screen reader, and the place Tab
// starts from, Approve coming next.
const focusOnMount = (element: HTMLElement | null) => element?.focus();

/** Asks the Current User whether an AI Client may act for them, once Quack has checked its request. */
export function ConsentPrompt({
  params,
  currentUser,
  onRedirect,
  onSwitchAccount,
}: ConsentPromptProps) {
  const check = useQuery(authorizationCheckOptions(params));

  return matchQuery(check, {
    Pending: () => (
      <div className="flex flex-col gap-4">
        <p role="status" className="sr-only">
          Checking the request…
        </p>
        <Skeleton aria-hidden className="h-9 w-full" />
        <Skeleton aria-hidden className="h-12 w-full" />
      </div>
    ),
    Error: ({ error }) =>
      error._tag === "AuthorizationRequestRefused" ? (
        <div role="alert" className="flex flex-col gap-2 text-center">
          <h1 className="text-xl font-semibold tracking-tight">This request cannot be approved</h1>
          <p className="text-sm text-muted-foreground">{error.error_description}</p>
        </div>
      ) : (
        <Empty>
          <EmptyHeader role="alert">
            <EmptyTitle>
              <h1>Could not load the request</h1>
            </EmptyTitle>
            <EmptyDescription>Check your connection and try again.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              size="sm"
              disabled={check.isFetching}
              onClick={() => check.refetch()}
            >
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      ),
    Success: ({ data }) => (
      <ConsentQuestion
        request={data}
        params={params}
        currentUser={currentUser}
        onRedirect={onRedirect}
        onSwitchAccount={onSwitchAccount}
      />
    ),
  });
}

function ConsentQuestion({
  request,
  params,
  currentUser,
  onRedirect,
  onSwitchAccount,
}: ConsentPromptProps & { readonly request: AuthorizationRequest }) {
  const { aiClient } = request;
  const decision = { payload: { ...params, csrfToken: request.csrfToken } };
  const onSuccess = ({ redirectTo }: { readonly redirectTo: string }) => onRedirect(redirectTo);
  const approve = useMutation(api.oauth.approveAuthorization.mutationOptions({ onSuccess }));
  const deny = useMutation(api.oauth.denyAuthorization.mutationOptions({ onSuccess }));
  const deciding = approve.isPending || deny.isPending;
  const leaving = approve.isSuccess || deny.isSuccess;

  if (leaving) {
    return (
      <p role="status" className="text-center text-sm text-muted-foreground">
        Going back to {aiClient.name}…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1
        ref={focusOnMount}
        tabIndex={-1}
        className="text-center text-xl font-semibold tracking-tight outline-none"
      >
        {consentSentence(aiClient, request.permissions, request.grantedPermissions)}
      </h1>
      {request.loopbackOnly && (
        <div
          role="note"
          className="flex gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
        >
          <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p>
            <span className="font-medium">Runs on this machine.</span>{" "}
            <span className="text-muted-foreground">
              Any program on it could claim to be {aiClient.name}. Approve only if you started it
              yourself.
            </span>
          </p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          className="h-12 w-full text-base"
          disabled={deciding}
          onClick={() => approve.mutate(decision)}
        >
          Approve
        </Button>
        <Button variant="ghost" disabled={deciding} onClick={() => deny.mutate(decision)}>
          Deny
        </Button>
        {(approve.isError || deny.isError) && (
          <p role="alert" className="text-center text-sm text-destructive">
            Could not send your answer. Try again.
          </p>
        )}
      </div>
      <details className="group rounded-lg border text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium">
          Details
          <ChevronDownIcon aria-hidden className="size-4 group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-3 border-t px-4 py-3">
          <p>
            You go back to <strong>{request.redirectHost}</strong> afterwards.
          </p>
          <p className="text-muted-foreground">
            The name “{aiClient.name}” is what the AI Client says it is. Only {aiClient.host} is
            verified.
          </p>
          <ul className="flex flex-col gap-1">
            {request.permissions.map((permission) => (
              <li key={permission} className="flex items-baseline justify-between gap-3">
                <code className="font-medium">{permission}</code>{" "}
                {request.grantedPermissions !== null && (
                  <span className="text-xs text-muted-foreground">
                    {request.grantedPermissions.includes(permission) ? "Already given" : "New"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </details>
      <p className="text-center text-sm text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{userLabel(currentUser)}</span>.{" "}
        <Button variant="link" size="xs" className="h-auto p-0" onClick={onSwitchAccount}>
          Not you? Switch account
        </Button>
      </p>
    </div>
  );
}
