import { Link, Text } from "react-email";

export function LinkFallback({ href }: { href: string }) {
  return (
    <Text className="text-muted-foreground my-3 text-xs leading-5">
      Or copy this link into your browser:
      <br />
      <Link href={href} className="text-foreground break-all underline">
        {href}
      </Link>
    </Text>
  );
}
