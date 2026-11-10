import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SupportButton } from "@/components/layout/SupportButton";
import { Clarity } from "@/components/analytics/Clarity";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { PwaInstallGuide } from "@/components/layout/PwaInstallGuide";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://clipesalfredd.top";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  alternates: {
    canonical: "/",
  },
  title: {
    default: "O Mapa Para Lucrar Com GTA VI",
    template: "%s · Alfredd",
  },
  description:
    "O GTA VI vai quebrar a internet, e não é possivel que você vai ficar de fora 🎬, até preguiçosos vão ganhar dinheiro com esse método 👇🏻.",
  applicationName: "Alfredd",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Alfredd",
    url: "/",
    title: "O Mapa Para Lucrar Com GTA VI",
    description:
      "O GTA VI vai quebrar a internet, e não é possivel que você vai ficar de fora 🎬, até preguiçosos vão ganhar dinheiro com esse método 👇🏻.",
    images: [{ url: "/alfredd-icon.png", width: 1024, height: 1024, alt: "Alfredd" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "O Mapa Para Lucrar Com GTA VI",
    description:
      "O GTA VI vai quebrar a internet, e não é possivel que você vai ficar de fora 🎬, até preguiçosos vão ganhar dinheiro com esse método 👇🏻.",
    images: ["/alfredd-icon.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/alfredd-icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/alfredd-icon.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Alfredd",
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
        <PwaInstallGuide />
        <Clarity />
        <MetaPixel />
      </body>
    </html>
  );
}
