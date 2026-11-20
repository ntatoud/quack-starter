import { useRouteContext } from "@tanstack/react-router";

import { PageHeader } from "#/features/layout/page-header.tsx";
import { ProfileForm } from "#/features/users/profile-form.tsx";

export function ProfileSettingsPage() {
  const { currentUser } = useRouteContext({ from: "/_authenticated/app/settings/profile" });

  return (
    <>
      <PageHeader crumbs={[{ label: "Settings" }, { label: "Profile" }]} back />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
        <ProfileForm currentUser={currentUser} />
      </div>
    </>
  );
}
