"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

/**
 * Client-component wrapper around next-themes' ThemeProvider so the root layout
 * (app/layout.tsx) can stay a Server Component while still mounting the provider.
 *
 * Phase 1 props (locked): attribute="class", defaultTheme="system", enableSystem.
 * See `app/layout.tsx`.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
