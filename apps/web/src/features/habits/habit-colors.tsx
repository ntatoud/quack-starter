import { HabitColor } from "@quack/contracts/habits/habit";

const swatches: Readonly<
  Record<HabitColor, { readonly label: string; readonly className: string }>
> = {
  red: { label: "Red", className: "bg-red-500" },
  orange: { label: "Orange", className: "bg-orange-500" },
  amber: { label: "Amber", className: "bg-amber-500" },
  green: { label: "Green", className: "bg-green-500" },
  teal: { label: "Teal", className: "bg-teal-500" },
  blue: { label: "Blue", className: "bg-blue-500" },
  violet: { label: "Violet", className: "bg-violet-500" },
  pink: { label: "Pink", className: "bg-pink-500" },
};

export const habitColorOptions = HabitColor.literals.map((value) => ({
  value,
  label: swatches[value].label,
}));

export function HabitColorDot({ color }: { color: HabitColor }) {
  return (
    <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${swatches[color].className}`} />
  );
}
