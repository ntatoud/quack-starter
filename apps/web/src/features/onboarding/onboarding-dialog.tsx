import { OnboardingPayload } from "@quack/contracts/identity/identity-api";
import type { User } from "@quack/contracts/identity/user";
import { schemaFormOptions } from "@quack/form/schema-form-options";
import { SubmitFailed } from "@quack/form/submit-failed";
import { useAppForm } from "@quack/form/use-app-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@quack/ui/components/dialog";
import { Button } from "@quack/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { Schema } from "effect";
import { useId } from "react";

import { useSignOut } from "#/features/identity/use-sign-out.ts";
import { api } from "#/lib/api.ts";

const decodeOnboardingPayload = Schema.decodeSync(OnboardingPayload);
const emptyOnboardingPayload: typeof OnboardingPayload.Encoded = { firstName: "", lastName: "" };

const ignore = () => {};

/** Cannot be closed: it leaves once the Current User is onboarded. */
export function OnboardingDialog({
  email,
  onOnboarded,
}: {
  email: string;
  onOnboarded: (user: User) => void | Promise<void>;
}) {
  const formId = useId();
  const signOut = useSignOut();
  const completeOnboarding = useMutation(api.identity.completeOnboarding.mutationOptions());

  const form = useAppForm({
    ...schemaFormOptions(OnboardingPayload, emptyOnboardingPayload),
    onSubmit: async ({ value }) => {
      const user = await completeOnboarding
        .mutateAsync({ payload: decodeOnboardingPayload(value) })
        .catch((cause: unknown) => {
          throw new SubmitFailed("Could not save your name. Try again.", { cause });
        });
      await onOnboarded(user);
    },
  });

  return (
    <Dialog open onOpenChange={ignore} disablePointerDismissal>
      <DialogContent showCloseButton={false} className="gap-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Welcome to Quack
          </DialogTitle>
          <DialogDescription>What should we call you?</DialogDescription>
          <p className="text-xs text-muted-foreground">Signed in as {email}</p>
        </DialogHeader>
        <form.AppForm>
          <form.Root id={formId} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <form.AppField name="firstName">
                {(field) => (
                  <field.Root>
                    <field.Label>First name</field.Label>
                    <field.Text autoComplete="given-name" />
                  </field.Root>
                )}
              </form.AppField>
              <form.AppField name="lastName">
                {(field) => (
                  <field.Root>
                    <field.Label>Last name</field.Label>
                    <field.Text autoComplete="family-name" />
                  </field.Root>
                )}
              </form.AppField>
            </div>
          </form.Root>
          {signOut.isError && (
            <p role="alert" className="text-sm text-destructive">
              Could not sign out. Try again.
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={signOut.isPending}
              onClick={() => signOut.mutate(undefined)}
            >
              {signOut.isPending ? "Signing out…" : "Sign out"}
            </Button>
            {/* Outside the form, so the footer stays the last part of the dialog: `form` ties it to the fields. */}
            <form.SubmitButton form={formId}>Get started</form.SubmitButton>
          </DialogFooter>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
