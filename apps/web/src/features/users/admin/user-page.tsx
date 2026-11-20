import { UserId } from "@quack/contracts/identity/user";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import { PageHeader } from "#/features/layout/page-header.tsx";
import { usePageTitle } from "#/features/layout/use-page-title.ts";
import { UserDetails } from "#/features/users/admin/user-details.tsx";
import { userQueryOptions } from "#/features/users/admin/users-query.ts";
import { userLabel } from "#/features/users/full-name.ts";

export function UserPage() {
  const id = UserId.make(useParams({ from: "/_authenticated/admin/users/$id" }).id);
  const user = useQuery(userQueryOptions(id));
  const name = user.data && userLabel(user.data);
  usePageTitle(name, "Users");

  return (
    <>
      <PageHeader
        title={name ?? "User"}
        trail={[{ label: "Users", to: "/admin/users" }]}
        back={{ fallback: "/admin/users" }}
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        <UserDetails id={id} />
      </div>
    </>
  );
}
