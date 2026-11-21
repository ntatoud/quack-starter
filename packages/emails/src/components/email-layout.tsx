import type { ReactNode } from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  pixelBasedPreset,
  Text,
} from "react-email";
import { brand } from "#/brand.ts";

// Mail clients ignore CSS variables and `oklch`: these are the light colors of `@quack/ui`'s theme, copied as hex.
const tailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        background: "#ffffff",
        foreground: "#0a0a0a",
        primary: "#171717",
        "primary-foreground": "#fafafa",
        muted: "#f5f5f5",
        "muted-foreground": "#737373",
        border: "#e5e5e5",
      },
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
            <Section>
              <Text
                className="m-0 inline-block h-10 w-10 rounded-lg text-center text-base leading-10 font-semibold"
                style={{ backgroundColor: brand.logo.background, color: brand.logo.foreground }}
              >
                {brand.logo.initials}
              </Text>
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
