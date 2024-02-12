"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-white group-[.toaster]:text-md group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          actionButton:
            "group-[.toast]:bg-transparent group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:bg-green-600",
          error: "group-[.toaster]:bg-red-600",
          info: "group-[.toaster]:bg-blue-600",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
