import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <EmptyState
        icon="compass"
        title="Página não encontrada"
        description="O conteúdo que você procura não existe ou foi movido."
        action={
          <Link href="/">
            <Button variant="primary">Voltar ao início</Button>
          </Link>
        }
      />
    </div>
  );
}
