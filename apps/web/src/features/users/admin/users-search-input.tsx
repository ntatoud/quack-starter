import { SearchInput } from "@quack/ui/components/search-input";
import { useNavigate } from "@tanstack/react-router";
import type { Ref } from "react";

export function UsersSearchInput({ search, ref }: { search: string; ref: Ref<HTMLInputElement> }) {
  const navigate = useNavigate({ from: "/admin/users" });

  return (
    <SearchInput
      ref={ref}
      className="w-48 lg:w-64"
      aria-label="Search users by name or email"
      placeholder="Search by name or email"
      maxLength={254}
      defaultValue={search}
      onSearch={(text) =>
        navigate({
          search: ({ page: _, q: __, ...rest }) => (text === "" ? rest : { ...rest, q: text }),
          replace: true,
        })
      }
    />
  );
}
