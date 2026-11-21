import { Avatar, AvatarFallback, AvatarImage } from "@quack/ui/components/avatar";
import BoringAvatar from "boring-avatars";
import type { ComponentProps } from "react";

const avatarColors = ["#7c3aed", "#ddd6fe"];

type UserAvatarProps = {
  user: { readonly id: string; readonly profile: { readonly avatarUrl: string | null } | null };
} & ComponentProps<typeof Avatar>;

export function UserAvatar({ user, ...props }: UserAvatarProps) {
  const avatarUrl = user.profile?.avatarUrl;

  return (
    <Avatar {...props}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
      <AvatarFallback aria-hidden="true" className="overflow-hidden">
        {/* `size-full!` beats the sidebar button, which sizes every svg inside it as an icon. */}
        <BoringAvatar
          name={user.id}
          variant="beam"
          colors={avatarColors}
          square
          className="size-full!"
        />
      </AvatarFallback>
    </Avatar>
  );
}
