import { Icon } from "@/components/ui/Icon";

export type MobileEditorTool = "trim" | "audio" | "text" | "effects" | "brand" | "speed";

const TOOL_LABELS: Record<MobileEditorTool, string> = {
  trim: "Cortar",
  audio: "Áudio",
  text: "Texto",
  effects: "Efeitos",
  brand: "Marca",
  speed: "Veloc.",
};

const TOOL_ICONS = {
  trim: "scissors",
  audio: "music",
  text: "subtitles",
  effects: "star",
  brand: "bookmark",
  speed: "clock",
} as const;

export function MobileEditorToolbar({
  activeTool,
  onChange,
  hasTextTool,
}: {
  activeTool: MobileEditorTool;
  onChange: (tool: MobileEditorTool) => void;
  hasTextTool: boolean;
}) {
  const tools: MobileEditorTool[] = hasTextTool
    ? ["trim", "audio", "text", "effects", "brand"]
    : ["trim", "audio", "effects", "brand", "speed"];

  return (
    <nav className="mobile-editor-toolbar fixed inset-x-0 bottom-0 z-50 hidden max-[700px]:grid grid-cols-5 border-t border-white/10 bg-[#111216]/96 pb-[env(safe-area-inset-bottom)] text-white backdrop-blur-xl" aria-label="Ferramentas do editor">
      {tools.map((tool) => (
        <button
          key={tool}
          type="button"
          onClick={() => onChange(tool)}
          className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition-colors ${activeTool === tool ? "text-white" : "text-white/45 hover:text-white/80"}`}
          aria-pressed={activeTool === tool}
        >
          <span className={`grid h-8 w-8 place-items-center rounded-xl transition-colors ${activeTool === tool ? "bg-white/15 text-white" : ""}`}>
            <Icon name={TOOL_ICONS[tool]} width={18} height={18} />
          </span>
          {TOOL_LABELS[tool]}
        </button>
      ))}
    </nav>
  );
}
