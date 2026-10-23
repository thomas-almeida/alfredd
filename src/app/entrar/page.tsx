import { redirect } from "next/navigation";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { AuthForm } from "@/features/auth/AuthForm";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Entrar" };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : "/";

  // Já autenticado? Vai direto para o destino.
  const session = await getSession();
  if (session) redirect(safeNext);

  return (
    <AppShell crumbs={[{ label: "Entrar" }]}>
      <PageHeader
        title="Entrar ou criar conta"
        subtitle="Cadastro rápido. Pedimos apenas quando você salva um clipe — depois você volta exatamente para onde estava."
      />
      <Card className="max-w-[420px]">
        <AuthForm next={safeNext} />
      </Card>
    </AppShell>
  );
}
