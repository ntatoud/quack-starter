import { formOptions, revalidateLogic, type StandardSchemaV1 } from "@tanstack/react-form";
import { Schema } from "effect";

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
