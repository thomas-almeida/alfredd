import type { Metadata } from "next";
import { AuthModalProvider } from "@/features/auth/AuthModal";
import { LandingPage } from "@/features/marketing/LandingPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conteúdo infinito de GTA VI na palma da sua mão", description: "Encontre os melhores momentos da Twitch e do YouTube, transforme em clipes e publique antes da concorrência." };

export default function LpPage() {
  return <AuthModalProvider><div className="min-h-screen bg-[#09090a]"><LandingPage /></div></AuthModalProvider>;
}
