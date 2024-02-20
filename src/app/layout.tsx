import type { Metadata } from "next";

import { Document } from "./Document";
import "./styles/globals.css";

export const metadata: Metadata = {
  title: "QuackStarter",
  description: "Quackly start your react project.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <Document>{children}</Document>;
}
