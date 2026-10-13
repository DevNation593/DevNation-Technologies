"use client";

import { openCookiePreferences } from "@/lib/cookie-consent";

interface CookiePreferencesButtonProps {
  className?: string;
  children: React.ReactNode;
}

export default function CookiePreferencesButton({
  className,
  children,
}: CookiePreferencesButtonProps) {
  return (
    <button type="button" onClick={openCookiePreferences} className={className}>
      {children}
    </button>
  );
}
