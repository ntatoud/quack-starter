import { brand } from "#/brand.ts";
import { Button } from "#/components/button.tsx";
import { EmailLayout } from "#/components/email-layout.tsx";
import { Heading } from "#/components/heading.tsx";
import { LinkFallback } from "#/components/link-fallback.tsx";
import { Text } from "#/components/text.tsx";
import { renderEmail } from "#/render-email.ts";

interface EmailChangeConfirmationProps {
  readonly url: string;
}

export default function EmailChangeConfirmationEmail({ url }: EmailChangeConfirmationProps) {
  return (
    <EmailLayout
      preview={`Confirm your new ${brand.name} email`}
      reason={`You got this email because someone asked for an Email Change of a ${brand.name} account to this email.`}
    >
      <Heading>Confirm your new email</Heading>
      <Text>
        Open the link below to make this email the one you sign in with. It lasts 24 hours and works
        once. Until then, your email stays the old one.
      </Text>
      <Button href={url}>Confirm this email</Button>
      <LinkFallback href={url} />
      <Text>If you did not ask for it, ignore this email: nothing changes.</Text>
    </EmailLayout>
  );
}

EmailChangeConfirmationEmail.PreviewProps = {
  url: "https://quack.localhost/confirm-email?token=preview",
} satisfies EmailChangeConfirmationProps;

export const emailChangeConfirmation = (props: EmailChangeConfirmationProps) =>
  renderEmail(`Confirm your new ${brand.name} email`, <EmailChangeConfirmationEmail {...props} />);
