"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/** Toggles the `.dark` class on <html> (see the `dark` custom variant in globals.css). */
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange {...props} />;
}
