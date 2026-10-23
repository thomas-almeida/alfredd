/** Junta classes condicionalmente (ignora valores falsy). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
