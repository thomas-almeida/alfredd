import type { Metadata } from "next";
import { AuthModalProvider } from "@/features/auth/AuthModal";
import { LandingPage } from "@/features/marketing/LandingPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "O Mapa Para Lucrar Com GTA VI" },
  description: "O GTA VI vai quebrar a internet, e não é possivel que você vai ficar de fora 🎬, até preguiçosos vão ganhar dinheiro com esse método 👇🏻.",
};

export default function LpPage() {
  return <AuthModalProvider><div className="min-h-screen bg-[#08010f]"><LandingPage /></div></AuthModalProvider>;
}
