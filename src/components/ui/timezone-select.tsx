"use client";

import { useState, useSyncExternalStore } from "react";
import { COMMON_TIMEZONES } from "@/lib/dates";
import { Select } from "./input";

const noopSubscribe = () => () => {};
const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** Timezone picker that defaults to the browser's timezone when no value is given. */
export function TimezoneSelect({ name = "timezone", defaultValue }: { name?: string; defaultValue?: string }) {
  // Server render uses UTC; the browser's zone takes over after hydration.
  const detected = useSyncExternalStore(noopSubscribe, browserTimezone, () => "UTC");
  const [picked, setPicked] = useState<string | null>(null);
  const value = picked ?? defaultValue ?? detected;

  const options = (COMMON_TIMEZONES as readonly string[]).includes(value) ? COMMON_TIMEZONES : [value, ...COMMON_TIMEZONES];

  return (
    <Select name={name} value={value} onChange={(e) => setPicked(e.target.value)}>
      {options.map((tz) => (
        <option key={tz} value={tz}>
          {tz.replaceAll("_", " ")}
        </option>
      ))}
    </Select>
  );
}
