import { Field, FieldDescription, FieldLabel } from "@quack/ui/components/field";
import { SegmentedControl, SegmentedControlItem } from "@quack/ui/components/segmented-control";
import {
  SettingsCard,
  SettingsRowControl,
  SettingsRowText,
} from "@quack/ui/components/settings-card";
import { usePreference } from "@ui-sdk/react/preferences";
import type { ReactNode } from "react";

import { usePreferences, useSidebarSide } from "#/features/preferences/preferences.ts";

/** A choice applies and is kept as soon as it is made: no form, no button, no request. */
export function PreferencesSettingsPage() {
  const { colorScheme, sidebarSide } = usePreferences();
  const { value: colorSchemeValue } = usePreference(colorScheme);
  const sidebarSideValue = useSidebarSide();

  return (
    <SettingsCard>
      <PreferenceRow
        label="Theme"
        description="Light or dark, on this device. System follows the operating system."
      >
        <SegmentedControl
          value={colorSchemeValue}
          onValueChange={(value) => value !== null && colorScheme.set(value)}
        >
          <SegmentedControlItem value="light">Light</SegmentedControlItem>
          <SegmentedControlItem value="dark">Dark</SegmentedControlItem>
          <SegmentedControlItem value="system">System</SegmentedControlItem>
        </SegmentedControl>
      </PreferenceRow>
      <PreferenceRow
        label="Sidebar"
        description="The side of the window the sidebar of the app sits on, on this device."
      >
        <SegmentedControl
          value={sidebarSideValue}
          onValueChange={(value) => value !== null && sidebarSide.set(value)}
        >
          <SegmentedControlItem value="left">Left</SegmentedControlItem>
          <SegmentedControlItem value="right">Right</SegmentedControlItem>
        </SegmentedControl>
      </PreferenceRow>
    </SettingsCard>
  );
}

function PreferenceRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Field>
      <SettingsRowText>
        <FieldLabel>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </SettingsRowText>
      <SettingsRowControl className="items-start @xl:items-end">{children}</SettingsRowControl>
    </Field>
  );
}
