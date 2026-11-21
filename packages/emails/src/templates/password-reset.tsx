import { brand } from "#/brand.ts";
import { Button } from "#/components/button.tsx";
import { EmailLayout } from "#/components/email-layout.tsx";
import { Heading } from "#/components/heading.tsx";
import { LinkFallback } from "#/components/link-fallback.tsx";
import { Text } from "#/components/text.tsx";
import { renderEmail } from "#/render-email.ts";

interface PasswordResetProps {
  readonly url: string;
}

export default function PasswordResetEmail({ url }: PasswordResetProps) {
  return (
    <EmailLayout
      preview={`Choose a new ${brand.name} password`}
      reason={`You got this email because someone asked for a Password Reset of your ${brand.name} account.`}
    >
      <Heading>Reset your password</Heading>
      <Text>Open the link below to choose a new password. It lasts 1 hour and works once.</Text>
      <Button href={url}>Choose a new password</Button>
      <LinkFallback href={url} />
      <Text>If you did not ask for it, ignore this email: your password stays the same.</Text>
    </EmailLayout>
  );
}

PasswordResetEmail.PreviewProps = {
  url: "https://quack.localhost/reset-password?token=preview",
} satisfies PasswordResetProps;

export const passwordReset = (props: PasswordResetProps) =>
  renderEmail(`Reset your ${brand.name} password`, <PasswordResetEmail {...props} />);
