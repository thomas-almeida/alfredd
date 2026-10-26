import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SupportButton } from "@/components/layout/SupportButton";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Alfredd — Descubra os melhores momentos antes que viralizem",
    template: "%s · Alfredd",
  },
  description:
    "Descubra, analise, organize e corte os melhores momentos da Twitch e do YouTube antes que viralizem.",
  applicationName: "Alfredd",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Alfredd",
    title: "Alfredd — Descubra os melhores momentos antes que viralizem",
    description:
      "Descubra, analise, organize e corte os melhores momentos da Twitch e do YouTube antes que viralizem.",
    images: [{ url: "/alfredd-icon.png", width: 1024, height: 1024, alt: "Alfredd" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Alfredd — Descubra os melhores momentos antes que viralizem",
    description:
      "Descubra, analise, organize e corte os melhores momentos da Twitch e do YouTube antes que viralizem.",
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
