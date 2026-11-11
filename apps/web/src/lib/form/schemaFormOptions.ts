import { formOptions, revalidateLogic, type StandardSchemaV1 } from "@tanstack/react-form";
import { Schema } from "effect";

/**
 * The options of a form validated by an Effect schema: spread them into `useAppForm`.
 * The form validates on submit, then on every change once a submit was attempted.
 * Validation does not transform the values: decode them with the schema in `onSubmit`.
 * An issue of a field shows on the field; an issue of the form itself shows at the end of `form.Form`.
 */
export const schemaFormOptions = <Values, Decoded>(
  schema: Schema.Codec<Decoded, Values>,
  defaultValues: Values,
) => {
  const validator: StandardSchemaV1<Values, Decoded> = Schema.toStandardSchemaV1(schema);
  return formOptions({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: validator },
  });
};
