import type { ReactNode } from "react";
import { Button as EmailButton, Section } from "react-email";

// The `lg` size of `@quack/ui`'s button: 36 pixels high, from the padding around one line of `text-sm`.
export function Button({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section className="my-6">
      <EmailButton
        href={href}
        className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm leading-5 font-medium no-underline"
      >
        {children}
      </EmailButton>
    </Section>
  );
}
