export type MetaEventName = "Lead" | "ViewContent";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function trackMetaEvent(name: MetaEventName, parameters: Record<string, unknown> = {}, eventId?: string) {
  if (typeof window === "undefined" || !window.fbq) return;
  if (eventId) window.fbq("track", name, parameters, { eventID: eventId });
  else window.fbq("track", name, parameters);
}
