"use client";

import { Formiz, useForm } from "@formiz/core";
import { ExternalLink, Heart } from "lucide-react";
import { useFormState } from "react-dom";
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
import { Separator } from "@/components/ui/separator";

export default function Home() {
  const form = useForm({
    onSubmit: (values) => console.log(values),
  });

  return (
    <div className="flex w-full max-w-6xl flex-col items-center justify-center gap-4">
      <ColorModeToggle />
      <Separator />
      <h2 className="text-3xl font-bold">Day picker</h2>
      <Formiz connect={form} autoForm>
        <div className="flex w-[20vw] flex-col items-center p-2">
          <FieldDatePicker
            name="date"
            label="Select a date"
            triggerClassName="w-[20vw]"
          />
          <Button type="submit">Submit</Button>
        </div>
      </Formiz>
      <Separator />
      <div className="flex w-full items-center justify-center gap-4">
        <Button>Sponsor</Button>
        <Button variant="secondary">See more</Button>
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
              toast.success("Well done! ", {
                description: "Hello",
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
              toast.error("Well done! ", {
                description: "Hello",
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
