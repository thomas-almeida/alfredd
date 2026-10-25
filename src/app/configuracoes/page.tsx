import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { ClipLanguageSetting } from "@/features/settings/ClipLanguageSetting";
import { DownloadDirectorySetting } from "@/features/settings/DownloadDirectorySetting";
import { getClipLanguage } from "@/lib/twitch/clipLanguage.server";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const lang = await getClipLanguage(undefined);
  return (
    <AppShell crumbs={[{ label: "Configurações" }]}>
      <PageHeader
        title="Configurações"
        subtitle="Perfil, preferências, fuso horário, privacidade e LGPD."
      />
      <div className="grid grid-cols-2 gap-4">
        <ClipLanguageSetting initial={lang} />
        <DownloadDirectorySetting />
      </div>
    </AppShell>
  );
}
