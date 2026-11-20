import { useRouteContext } from "@tanstack/react-router";

import { ProfileForm } from "#/features/profile/profile-form.tsx";

export function ProfileSettingsPage() {
  const { currentUser } = useRouteContext({ from: "/_authenticated/app/settings/profile" });

  return <ProfileForm currentUser={currentUser} />;
}
