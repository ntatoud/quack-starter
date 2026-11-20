import { Avatar, AvatarFallback, AvatarImage } from "@quack/ui/components/avatar";
import BoringAvatar from "boring-avatars";
import type { ComponentProps } from "react";

const duotone = ["#7c3aed", "#ddd6fe"];

type UserAvatarProps = {
  user: { readonly id: string; readonly profile: { readonly avatarUrl: string | null } | null };
} & ComponentProps<typeof Avatar>;

export function UserAvatar({ user, className, ...props }: UserAvatarProps) {
  const avatarUrl = user.profile?.avatarUrl;

  return (
    <Avatar className={className} {...props}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt="" className="rounded-[inherit]" />}
      <AvatarFallback aria-hidden="true" className="overflow-hidden rounded-[inherit]">
        {/* Seeded by the id, which never changes, so a User keeps their avatar. `size-full!`
            beats the sidebar button, which sizes every svg inside it as an icon. */}
        <BoringAvatar
          name={user.id}
          variant="beam"
          colors={duotone}
          square
          className="size-full!"
        />
      </AvatarFallback>
    </Avatar>
  );
}
