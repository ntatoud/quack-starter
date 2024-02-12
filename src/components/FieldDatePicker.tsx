"use client";

import { type FieldProps, useField } from "@formiz/core";
import dayjs from "dayjs";
import { CalendarIcon } from "lucide-react";
import { InputProps } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { Label } from "./ui/label";

type Value = string;

type UsualInputProps = "placeholder";

export type FieldInputProps<FormattedValue = Value> = FieldProps<
  Value,
  FormattedValue
> &
  Pick<InputProps, UsualInputProps> & {
    inputProps?: Omit<InputProps, UsualInputProps>;
    triggerClassName?: string;
    label: string;
    maxDate?: Date;
    minDate?: Date;
  };

export const FieldDatePicker = <FormattedValue = Value,>(
  props: FieldInputProps<FormattedValue>,
) => {
  const field = useField(props);
  const { label, inputProps, ...otherProps } = field.otherProps;

  return (
    <div>
      <input
        id={field.id}
        type="date"
        value={field.value ?? ""}
        onChange={(e) =>
          field.setValue(dayjs(e.target.value).format("YYYY-MM-DD"))
        }
        required={field.isRequired}
        className="invisible"
        {...inputProps}
      />
      <div className="flex w-full flex-col items-start gap-0.5">
        <Label htmlFor={field.id}>
          {label}
          {field.isRequired && <p className="text-xs text-red-500">*</p>}
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "text-md h-12 w-full justify-start text-left font-normal",
                !field.value && "text-muted-foreground",
                otherProps.triggerClassName,
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {field.value ? (
                dayjs(field.value?.toString()).format("DD MMM YYYY")
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={new Date(field.value ?? dayjs().format("YYYY-MM-DD"))}
              onSelect={(date) =>
                field.setValue(dayjs(date ?? "").format("YYYY-MM-DD"))
              }
              fromDate={otherProps.minDate}
              toDate={otherProps.maxDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {!!field.shouldDisplayError && (
          <p className="text-sm text-red-500">{field.errorMessage}</p>
        )}
      </div>
    </div>
  );
};
