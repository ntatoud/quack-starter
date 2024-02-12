"use client";

import type { ReactNode } from "react";

import { Inter } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import i18n from "@/lib/i18n/client";
import { AVAILABLE_LANGUAGES } from "@/lib/i18n/constants";
import { TrpcProvider } from "@/lib/trpc/TrpcProvider";

import { ThemeProvider } from "./styles/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const Document = ({ children }: { children: ReactNode }) => {
  return (
    <html
      lang={i18n.language}
      dir={
        AVAILABLE_LANGUAGES.find(({ key }) => key === i18n.language)?.dir ??
        "ltr"
      }
      suppressHydrationWarning
    >
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TrpcProvider>
            <main className="flex min-h-screen flex-col items-center justify-between p-24">
              {children}
            </main>

            <Toaster position="top-center" />
          </TrpcProvider>
        </ThemeProvider>
      </body>
    </html>
  );
};
