import type { ReactNode } from "react";
import { Button as EmailButton, Section } from "react-email";

// Mail clients ignore the height of a link: the padding around one line of text gives it the `lg` size of `@quack/ui`'s button.
export function Button({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section className="my-6">
      <EmailButton
        href={href}
        className="bg-primary text-primary-foreground rounded-lg px-2.5 py-2 text-sm leading-5 font-medium no-underline"
      >
        {children}
      </EmailButton>
    </Section>
  );
}
