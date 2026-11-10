"use client";

import { Icon } from "@/components/ui/Icon";

export function MobileMenuButton() {
  return (
    <button
      type="button"
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg min-[861px]:hidden"
      aria-label="Abrir menu"
      onClick={() => window.dispatchEvent(new Event("alfredd:toggle-mobile-sidebar"))}
    >
      <Icon name="menu" width={20} height={20} />
    </button>
  );
}
