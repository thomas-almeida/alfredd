import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
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
      <div className="flex min-h-[calc(100vh-var(--spacing-topbar)-3rem)] flex-col items-center justify-center py-8">
        <div className="mb-6 w-full max-w-[460px] text-center">
          <h1 className="text-[2.25rem] font-bold tracking-tight max-[520px]:text-3xl">
            Entrar ou criar conta
          </h1>
          <p className="mx-auto mt-3 max-w-[52ch] text-sm leading-6 text-muted">
            Cadastro rápido. Pedimos apenas quando você salva um clipe — depois
            você volta exatamente para onde estava.
          </p>
        </div>
        <Card className="w-full max-w-[420px] shadow-[0_16px_48px_rgba(0,0,0,0.25)]">
          <AuthForm next={safeNext} />
        </Card>
      </div>
    </AppShell>
  );
}
