import { brand } from "@quack/brand/brand";
import { Duration } from "effect";
import { Button } from "#/components/button.tsx";
import { EmailLayout } from "#/components/email-layout.tsx";
import { Heading } from "#/components/heading.tsx";
import { LinkFallback } from "#/components/link-fallback.tsx";
import { Text } from "#/components/text.tsx";
import { formatLifetime } from "#/lifetime.ts";
import { renderEmail } from "#/render-email.ts";

interface PasswordResetProps {
  readonly url: string;
  readonly lifetime: Duration.Duration;
}

export default function PasswordResetEmail({ url, lifetime }: PasswordResetProps) {
  return (
    <EmailLayout
      preview={`Choose a new password: the link lasts ${formatLifetime(lifetime)}.`}
      reason={`someone asked for a password reset of your ${brand.name} account.`}
    >
      <Heading>Reset your password</Heading>
      <Text>
        Open the link below to choose a new password. It lasts {formatLifetime(lifetime)} and works
        once.
      </Text>
      <Button href={url}>Choose a new password</Button>
      <LinkFallback href={url} />
      <Text muted>If you did not ask for it, ignore this email: your password stays the same.</Text>
    </EmailLayout>
  );
}

PasswordResetEmail.PreviewProps = {
  url: "https://quack.localhost/reset-password?token=preview",
  lifetime: Duration.hours(1),
} satisfies PasswordResetProps;

export const passwordReset = (props: PasswordResetProps) =>
  renderEmail(`Reset your ${brand.name} password`, <PasswordResetEmail {...props} />);
