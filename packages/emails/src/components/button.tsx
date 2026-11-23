import type { ReactNode } from "react";
import { Button as EmailButton, Section } from "react-email";

// Mail clients ignore the height of a link: the padding around one line of text gives it the `lg` size of `@quack/ui`'s button.
// Its edge and its highlight are a bottom and a top border, taken from its padding so the button keeps that size.
export function Button({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section className="my-6">
      <EmailButton
        href={href}
        className="bg-primary text-primary-foreground border-b-button-depth border-b-primary-edge border-t-highlight border-t-primary-highlight rounded-lg px-2.5 pt-[7px] pb-1.5 text-sm leading-5 font-medium no-underline"
      >
        {children}
      </EmailButton>
    </Section>
  );
}
