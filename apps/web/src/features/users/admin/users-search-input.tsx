import { SearchInput } from "@quack/ui/components/search-input";
import { useNavigate } from "@tanstack/react-router";

export function UsersSearchInput({ search }: { search: string }) {
  const navigate = useNavigate({ from: "/users" });

  return (
    <SearchInput
      className="max-w-sm"
      aria-label="Search users by email"
      placeholder="Search by email"
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
