import { brand } from "@quack/brand/brand";
import { emailTheme } from "@quack/brand/email-theme";
import type { ReactNode } from "react";
import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Tailwind,
  pixelBasedPreset,
  Text,
} from "react-email";

const tailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: emailTheme.colors,
      borderRadius: { lg: emailTheme.radius },
    },
  },
};

export function EmailLayout({
  preview,
  reason,
  children,
}: {
  preview: string;
  reason: string;
  children: ReactNode;
}) {
  return (
    <Html lang="en">
      <Tailwind config={tailwindConfig}>
        <Head />
        <Preview>{preview}</Preview>
        <Body className="bg-muted m-0 py-10 font-sans">
          <Container className="bg-background border-border mx-auto max-w-[480px] rounded-lg border border-solid px-10 py-8">
            {/* The `Logo` of `@quack/brand`, in tables: mail clients lay out no flexbox. */}
            <Section>
              <Row>
                <Column
                  data-skip-in-text
                  className="bg-primary text-primary-foreground h-8 w-8 rounded-lg text-center text-base font-semibold"
                >
                  {brand.initial}
                </Column>
                <Column className="text-foreground pl-2 text-base font-semibold">
                  {brand.name}
                </Column>
              </Row>
            </Section>
            {children}
            <Hr className="border-border my-6" />
            <Text className="text-muted-foreground m-0 text-xs leading-5">{reason}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
