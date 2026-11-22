import { brand } from "@quack/brand/brand";
import { Duration } from "effect";
import { Button } from "#/components/button.tsx";
import { EmailLayout } from "#/components/email-layout.tsx";
import { Heading } from "#/components/heading.tsx";
import { LinkFallback } from "#/components/link-fallback.tsx";
import { Text } from "#/components/text.tsx";
import { formatLifetime } from "#/lifetime.ts";
import { renderEmail } from "#/render-email.ts";

interface EmailChangeConfirmationProps {
  readonly url: string;
  readonly lifetime: Duration.Duration;
}

export default function EmailChangeConfirmationEmail({
  url,
  lifetime,
}: EmailChangeConfirmationProps) {
  return (
    <EmailLayout
      preview={`Open the link to sign in with this email from now on. It lasts ${formatLifetime(lifetime)}.`}
      reason={`someone asked to change the email of a ${brand.name} account to this one.`}
    >
      <Heading>Confirm your new email</Heading>
      <Text>
        Open the link below to make this email the one you sign in with. It lasts{" "}
        {formatLifetime(lifetime)} and works once. Until then, your email stays the old one.
      </Text>
      <Button href={url}>Confirm this email</Button>
      <LinkFallback href={url} />
      <Text muted>If you did not ask for it, ignore this email: nothing changes.</Text>
    </EmailLayout>
  );
}

EmailChangeConfirmationEmail.PreviewProps = {
  url: "https://quack.localhost/confirm-email?token=preview",
  lifetime: Duration.hours(24),
} satisfies EmailChangeConfirmationProps;

export const emailChangeConfirmation = (props: EmailChangeConfirmationProps) =>
  renderEmail(`Confirm your new ${brand.name} email`, <EmailChangeConfirmationEmail {...props} />);
