import { EditorLoader } from "@/features/editor/EditorLoader";

export default function Loading() {
  return (
    <div className="p-8">
      <EditorLoader
        title="Abrindo o editor…"
        progress={null}
        steps={[
          { label: "Salvando o clipe na sua biblioteca", state: "active" },
          { label: "Carregando seu projeto", state: "todo" },
        ]}
      />
    </div>
  );
}
