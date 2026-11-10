import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

export function MobileEditorTopBar({
  saving,
  canUndo,
  canRedo,
  onBack,
  onUndo,
  onRedo,
  children,
}: {
  saving: "idle" | "saving" | "saved";
  canUndo: boolean;
  canRedo: boolean;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  children: ReactNode;
}) {
  return (
    <header className="mobile-editor-topbar hidden max-[700px]:flex fixed inset-x-0 top-0 z-50 h-14 items-center justify-between gap-2 border-b border-white/10 bg-[#090a0d]/95 px-3 text-white backdrop-blur-md">
      <button type="button" onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10" aria-label="Sair do editor">
        <Icon name="close" width={20} height={20} />
      </button>
      <div className="min-w-0 flex-1 text-center">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">Editor</span>
        <span className="block truncate text-[11px] text-white/45">
          {saving === "saving" ? "Salvando…" : saving === "saved" ? "Salvo" : "Pronto"}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={onUndo} disabled={!canUndo} className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10 disabled:opacity-30" aria-label="Desfazer">
          <Icon name="undo" width={18} height={18} />
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo} className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10 disabled:opacity-30" aria-label="Refazer">
          <Icon name="redo" width={18} height={18} />
        </button>
        {children}
      </div>
    </header>
  );
}
