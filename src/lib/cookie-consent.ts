import { useSyncExternalStore } from "react";
import { cookieConsent } from "@/lib/site";

export type CookieConsentChoice = "granted" | "denied";
type CookieConsentState = CookieConsentChoice | "unset" | "pending";

const listeners = new Set<() => void>();
let preferencesOpen = false;

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readConsent(): CookieConsentState {
  const prefix = `${cookieConsent.name}=`;
  const value = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length);

  return value === "granted" || value === "denied" ? value : "unset";
}

export function saveCookieConsent(choice: CookieConsentChoice) {
  const maxAge = cookieConsent.maxAgeDays * 24 * 60 * 60;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = `${cookieConsent.name}=${choice}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
  preferencesOpen = false;
  notify();
}

export function openCookiePreferences() {
  preferencesOpen = true;
  notify();
}

// "pending" is the server snapshot: nothing is shown or loaded until the cookie has been read.
export function useCookieConsent() {
  return useSyncExternalStore<CookieConsentState>(
    subscribe,
    readConsent,
    () => "pending",
  );
}

export function useCookiePreferencesOpen() {
  return useSyncExternalStore(
    subscribe,
    () => preferencesOpen,
    () => false,
  );
}
