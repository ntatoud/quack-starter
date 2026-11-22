import { brand } from "@quack/brand/brand";
import { Button } from "#/components/button.tsx";
import { EmailLayout } from "#/components/email-layout.tsx";
import { Heading } from "#/components/heading.tsx";
import { LinkFallback } from "#/components/link-fallback.tsx";
import { Text } from "#/components/text.tsx";
import { renderEmail } from "#/render-email.ts";

interface PasswordChangedProps {
  readonly resetUrl: string;
}

export default function PasswordChangedEmail({ resetUrl }: PasswordChangedProps) {
  return (
    <EmailLayout
      preview="If it was not you, reset your password now."
      reason={`the password of your ${brand.name} account changed.`}
    >
      <Heading>Your password changed</Heading>
      <Text>
        The password of your {brand.name} account just changed. If it was you, there is nothing more
        to do.
      </Text>
      <Text>If it was not you, reset your password now: someone else may know it.</Text>
      <Button href={resetUrl}>Reset your password</Button>
      <LinkFallback href={resetUrl} />
    </EmailLayout>
  );
}

PasswordChangedEmail.PreviewProps = {
  resetUrl: "https://quack.localhost/forgot-password",
} satisfies PasswordChangedProps;

export const passwordChanged = (props: PasswordChangedProps) =>
  renderEmail(`Your ${brand.name} password changed`, <PasswordChangedEmail {...props} />);
