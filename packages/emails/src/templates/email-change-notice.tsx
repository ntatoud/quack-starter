import { brand } from "@quack/brand/brand";
import { EmailLayout } from "#/components/email-layout.tsx";
import { Heading } from "#/components/heading.tsx";
import { Text } from "#/components/text.tsx";
import { renderEmail } from "#/render-email.ts";

interface EmailChangeNoticeProps {
  readonly newEmail: string;
}

// Enough for the User to recognize the email they asked for, too little to give it away to whoever else reads this inbox.
// The stars are as many whatever the length, which they would otherwise tell.
const mask = (email: string) => `${email.slice(0, 1)}***${email.slice(email.lastIndexOf("@"))}`;

export default function EmailChangeNoticeEmail({ newEmail }: EmailChangeNoticeProps) {
  return (
    <EmailLayout
      preview="If it was not you, reset your password."
      reason={`someone asked to change the email of your ${brand.name} account.`}
    >
      <Heading>Your email is changing</Heading>
      <Text>
        Someone asked to change the email of your {brand.name} account to {mask(newEmail)}. The
        change takes effect once the link sent to that email is opened.
      </Text>
      <Text>
        If it was not you, reset your password from the sign-in page: someone else may know it.
      </Text>
    </EmailLayout>
  );
}

EmailChangeNoticeEmail.PreviewProps = {
  newEmail: "jane.doe@example.com",
} satisfies EmailChangeNoticeProps;

export const emailChangeNotice = (props: EmailChangeNoticeProps) =>
  renderEmail(`Your ${brand.name} email is changing`, <EmailChangeNoticeEmail {...props} />);
