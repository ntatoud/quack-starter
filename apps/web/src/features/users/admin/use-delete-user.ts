import type { UserId } from "@quack/contracts/identity/user";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { userQueryOptions } from "#/features/users/admin/users-query.ts";
import { api } from "#/lib/api.ts";

/** Deletes the User, then leads to the Users table. A User another Admin deleted first counts as deleted. */
export const useDeleteUser = (id: UserId) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const leave = async () => {
    await queryClient.invalidateQueries({ queryKey: api.users.list.key() });
    // The page goes before the User's query: still shown, it would ask again for them, and be told they are not found.
    await navigate({ to: "/admin/users" }).finally(() =>
      queryClient.removeQueries({ queryKey: userQueryOptions(id).queryKey }),
    );
  };

  return useMutation(
    api.users.remove.mutationOptions({
      onSuccess: leave,
      onError: (error) => (error._tag === "UserNotFound" ? leave() : undefined),
    }),
  );
};
