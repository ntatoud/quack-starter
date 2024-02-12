"use client";

import { Formiz, useForm } from "@formiz/core";
import { ExternalLink, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ColorModeToggle } from "@/components/ColorModeToggle";
import { FieldDatePicker } from "@/components/FieldDatePicker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import i18n from "@/lib/i18n/client";
import { AVAILABLE_LANGUAGES } from "@/lib/i18n/constants";

export default function Home() {
  const form = useForm({
    onSubmit: (values) => console.log(values),
  });

  const { t } = useTranslation();
  return (
    <div className="flex w-full max-w-6xl flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        <ColorModeToggle />
        <Separator orientation="vertical" className="w-2" />
        <Label>{t("home.labels.language")}</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-28">
              {t(`languages.${i18n.language}`)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-28">
            {AVAILABLE_LANGUAGES.map(({ key }) => (
              <DropdownMenuItem
                className="cursor-pointer disabled:cursor-not-allowed disabled:text-muted-foreground"
                disabled={key === i18n.language}
                key={`lang-${key}`}
                onClick={() => i18n.changeLanguage(key)} // TODO : Proper change handling once db is set up
              >
                {t(`languages.${key}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Separator />

      <h2 className="text-3xl font-bold">{t("home.hello")}</h2>
      <Formiz connect={form} autoForm>
        <div className="flex w-[20vw] flex-col items-center p-2">
          <FieldDatePicker
            name="date"
            label="Pick a date"
            triggerClassName="w-[20vw]"
          />
          <Button type="submit">{t("actions.submit")}</Button>
        </div>
      </Formiz>
      <Separator />
      <div className="flex w-full items-center justify-center gap-4">
        <Button>Sponsor</Button>
        <Button variant="secondary">{t("actions.seeMore")}</Button>
      </div>
      <Separator />
      <Alert className="max-w-md">
        <Heart />
        <AlertTitle>Alert !</AlertTitle>
        <AlertDescription>Description of the alert</AlertDescription>
      </Alert>
      <Alert className="max-w-md" variant="success">
        <Heart />
        <AlertTitle>Alert !</AlertTitle>
        <AlertDescription>Description of the alert</AlertDescription>
      </Alert>
      <Alert className="max-w-md" variant="destructive">
        <Heart />
        <AlertTitle>Destructive Alert!</AlertTitle>
        <AlertDescription>
          Description of the destructive alert
        </AlertDescription>
      </Alert>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            Toasts<Badge variant="default">New</Badge>
          </CardTitle>{" "}
          Click the button to show a toast
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button
            onClick={() =>
              toast.success(t("feedback.success.title"), {
                description: t("feedback.success.description"),
                action: {
                  label: <ExternalLink />,
                  onClick: () => console.log("yes"),
                },
                closeButton: true,
              })
            }
          >
            Show success toast
          </Button>

          <Button
            variant="destructiveSecondary"
            onClick={() =>
              toast.error(t("feedback.error.title"), {
                description: t("feedback.error.description"),
              })
            }
          >
            Show error toast
          </Button>
        </CardContent>
        <CardFooter className="text-muted-foreground">
          Using shadcn-ui sonner
        </CardFooter>
      </Card>
    </div>
  );
}
