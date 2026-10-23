import { cookies } from "next/headers";
import { CLIP_LANGUAGE_COOKIE, resolveLanguage } from "./languages";

/** Idioma efetivo da página: ?lang= > padrão das configurações > português. */
export async function getClipLanguage(param: string | undefined): Promise<string> {
  const saved = (await cookies()).get(CLIP_LANGUAGE_COOKIE)?.value;
  return resolveLanguage(param, saved);
}
