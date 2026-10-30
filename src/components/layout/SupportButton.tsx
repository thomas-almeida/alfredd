import Image from "next/image";

const WHATSAPP_URL = "https://chat.whatsapp.com/Hl7m99pNIsXBNrAQuDYjrZ";

/** Botão flutuante de suporte via WhatsApp, fixo no canto inferior direito. */
export function SupportButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chamar Suporte"
      className="group fixed bottom-5 right-5 z-[80] h-14 w-14 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-transform hover:scale-105 max-[560px]:bottom-3 max-[560px]:right-3 max-[560px]:h-11 max-[560px]:w-11"
    >
      <Image src="/whatsapp.png" alt="" width={56} height={56} className="h-full w-full rounded-full" />
      <span
        role="tooltip"
        className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-3 whitespace-nowrap rounded-md bg-surface-2 border border-border-strong px-3 py-1.5 text-[13px] font-medium text-fg opacity-0 translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100"
      >
        Chamar Suporte
      </span>
    </a>
  );
}
