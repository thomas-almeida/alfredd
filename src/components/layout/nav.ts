import type { IconName } from "@/components/ui/Icon";

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  platformLogo?: "twitch" | "youtube";
  /** Marca recursos exclusivos do plano PRO (apenas rótulo nesta fase). */
  pro?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    items: [
      { label: "Início", href: "/", icon: "compass" },
      { label: "Explorar", href: "/explorar", icon: "search" },
    ],
  },
  {
    title: "Minha área",
    items: [
      { label: "Biblioteca", href: "/biblioteca", icon: "bookmark" },
      { label: "Favoritos", href: "/favoritos", icon: "star" },
    ],
  },
  {
    title: "Clipe Mais Rápido",
    items: [
      { label: "VODs da Twitch", href: "/twitch", icon: "film", platformLogo: "twitch" },
      { label: "Vídeos do YouTube", href: "/youtube", icon: "play", platformLogo: "youtube" },
    ],
  },
  {
    title: "RECURSOS INTELIGENTES",
    items: [
      { label: "Monitoramentos", href: "/monitoramentos", icon: "radar", pro: true },
      { label: "Notificações", href: "/notificacoes", icon: "bell", pro: true },
      { label: "Assinatura", href: "/assinatura", icon: "card" },
    ],
  },
  {
    title: "Conta",
    items: [
      { label: "Configurações", href: "/configuracoes", icon: "settings" },
    ],
  },
];
