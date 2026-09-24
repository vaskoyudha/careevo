"use client";

import { useCallback, useState } from "react";

/**
 * Track the length of a text value against a fixed limit.
 *
 * Companion to the profile dialog's biography field: exposes the live value,
 * its character count, and an onChange handler that stops accepting input past
 * `maxLength` (so the counter never goes negative).
 */
export function useCharacterLimit({
  maxLength,
  initialValue = "",
}: {
  maxLength: number;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue.slice(0, maxLength));
  const [characterCount, setCharacterCount] = useState(
    initialValue.slice(0, maxLength).length,
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value;
      if (next.length <= maxLength) {
        setValue(next);
        setCharacterCount(next.length);
      }
    },
    [maxLength],
  );

  return { value, characterCount, handleChange, maxLength };
}
