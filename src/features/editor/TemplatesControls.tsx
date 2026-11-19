"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEditor } from "@/lib/editor/store";
import { Icon } from "@/components/ui/Icon";
import type { EditorTemplate } from "@/lib/editor/presets";
import type { Json } from "@/lib/supabase/database.types";

interface TemplateRow {
  id: string;
  name: string;
  state: EditorTemplate;
}

/**
 * Aba "Modelos": salva o enquadramento/textos/imagem atuais como um molde
 * reutilizável (por usuário, no Supabase) e aplica um molde salvo ao clipe atual.
 */
export function TemplatesControls({
  userId,
  onApplied,
}: {
  userId: string;
  onApplied?: () => void;
}) {
  const [rows, setRows] = useState<TemplateRow[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("editor_presets")
      .select("id,name,state")
      .order("updated_at", { ascending: false });
    if (error) {
      setError("Não foi possível carregar seus modelos.");
      setRows([]);
      return;
    }
    setRows(
      (data ?? []).map((d) => ({
        id: d.id as string,
        name: d.name as string,
        state: d.state as unknown as EditorTemplate,
      })),
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const tpl = useEditor.getState().getTemplate();
    const { error } = await supabase
      .from("editor_presets")
      .insert({ user_id: userId, name: trimmed, state: tpl as unknown as Json });
    setBusy(false);
    if (error) {
      setError("Falha ao salvar o modelo.");
      return;
    }
    setName("");
    load();
  };

  const apply = (row: TemplateRow) => {
    useEditor.getState().applyTemplate(row.state);
    setAppliedId(row.id);
    window.setTimeout(() => setAppliedId((id) => (id === row.id ? null : id)), 1600);
    onApplied?.();
  };

  const remove = async (row: TemplateRow) => {
    if (!window.confirm(`Excluir o modelo “${row.name}”?`)) return;
    setRows((r) => r?.filter((x) => x.id !== row.id) ?? null);
    const supabase = createClient();
    await supabase.from("editor_presets").delete().eq("id", row.id);
  };

  const commitRename = async () => {
    if (!renaming) return;
    const trimmed = renaming.value.trim();
    const target = renaming.id;
    setRenaming(null);
    if (!trimmed) return;
    setRows((r) => r?.map((x) => (x.id === target ? { ...x, name: trimmed } : x)) ?? null);
    const supabase = createClient();
    await supabase
      .from("editor_presets")
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq("id", target);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        Salve o enquadramento, focos, textos e a marca d’água atuais como um modelo e
        reaplique em clipes parecidos com um clique. O corte do clipe não entra no modelo.
      </p>

      <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 p-2.5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Nome do modelo (ex.: Padrão webcam)"
          maxLength={60}
          className="min-w-0 flex-1 rounded-sm border border-border bg-surface px-2.5 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={save}
          disabled={!name.trim() || busy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-accent px-3 py-2 text-xs font-semibold text-accent-fg disabled:opacity-50"
        >
          <Icon name="plus" width={15} height={15} />
          {busy ? "Salvando…" : "Salvar modelo"}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {rows === null ? (
        <p className="text-xs text-subtle">Carregando modelos…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-subtle">
          Você ainda não tem modelos. Monte um clipe do seu jeito e clique em “Salvar modelo”.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-2 rounded-md border border-border bg-surface-2 p-2 pl-3"
            >
              <Icon name="copy" width={15} height={15} className="shrink-0 text-muted" />
              {renaming?.id === row.id ? (
                <input
                  autoFocus
                  type="text"
                  value={renaming.value}
                  maxLength={60}
                  onChange={(e) => setRenaming({ id: row.id, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  onBlur={commitRename}
                  className="min-w-0 flex-1 rounded-sm border border-border bg-surface px-2 py-1 text-[13px] text-fg focus:border-accent focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setRenaming({ id: row.id, value: row.name })}
                  title="Renomear"
                  className="min-w-0 flex-1 truncate text-left text-[13px] text-fg hover:text-accent"
                >
                  {row.name}
                </button>
              )}
              <button
                type="button"
                onClick={() => apply(row)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-sm px-2.5 py-1.5 text-xs font-semibold ${
                  appliedId === row.id
                    ? "bg-accent/20 text-accent"
                    : "bg-accent text-accent-fg"
                }`}
              >
                {appliedId === row.id ? "Aplicado ✓" : "Aplicar"}
              </button>
              <button
                type="button"
                onClick={() => remove(row)}
                aria-label={`Excluir modelo ${row.name}`}
                className="shrink-0 rounded-sm p-1.5 text-muted hover:bg-surface hover:text-red-400"
              >
                <Icon name="trash" width={15} height={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
