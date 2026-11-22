import { brand } from "@quack/brand/brand";
import { emailTheme } from "@quack/brand/email-theme";
import type { ReactNode } from "react";
import {
  Body,
  Column,
  Container,
  Head,
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
  theme: { extend: { colors: emailTheme.colors, borderRadius: emailTheme.radii } },
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
        <Body className="bg-muted m-0 px-3 py-10 font-sans">
          <Container className="mx-auto max-w-[480px]">
            {/* The `Logo` of `@quack/brand`, in tables: mail clients lay out no flexbox. */}
            <Section className="mb-6">
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
            <Section className="bg-background border-border rounded-xl border border-solid px-6 py-6">
              {children}
            </Section>
            <Text className="text-muted-foreground mx-0 mt-6 mb-0 text-center text-xs leading-5">
              You got this email because {reason}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
