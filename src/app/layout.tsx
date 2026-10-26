import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SupportButton } from "@/components/layout/SupportButton";

export const metadata: Metadata = {
  title: {
    default: "Clipes — Descubra os melhores momentos antes que viralizem",
    template: "%s · Clipes",
  },
  description:
    "Radar de cortes da Twitch: descubra, analise, organize e monitore clipes relevantes de jogos e streamers. Pare de procurar cortes.",
  applicationName: "Clipes",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/alfredd-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <SupportButton />
      </body>
    </html>
  );
}
