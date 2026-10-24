"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export interface StreamerOption {
  name: string;
  avatar: string | null;
}

interface Props {
  streamers: StreamerOption[];
  games: string[];
  streamer: string;
  game: string;
}

const field =
  "h-8 min-w-48 rounded-sm border border-border-strong bg-surface-2 px-2.5 text-xs text-fg";

function Avatar({ src, name }: { src: string | null; name: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="size-5 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-hover text-[10px] uppercase">
      {name[0]}
    </span>
  );
}

// Select nativo não mostra imagens, então o de streamer é um dropdown próprio.
function StreamerSelect({
  options,
  value,
  onChange,
}: {
  options: StreamerOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.name === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(field, "flex items-center gap-2 text-left")}
      >
        {current ? (
          <>
            <Avatar src={current.avatar} name={current.name} />
            <span className="truncate">{current.name}</span>
          </>
        ) : (
          <span className="text-muted">Todos os streamers</span>
        )}
        <span className="ml-auto text-muted">▾</span>
      </button>
      {open && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-sm border border-border-strong bg-surface-2 py-1 shadow-lg">
          <li>
            <button
              type="button"
              onClick={() => pick("")}
              className="w-full px-2.5 py-1.5 text-left text-xs text-muted hover:bg-surface-hover"
            >
              Todos os streamers
            </button>
          </li>
          {options.map((o) => (
            <li key={o.name}>
              <button
                type="button"
                onClick={() => pick(o.name)}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-surface-hover",
                  o.name === value && "text-accent",
                )}
              >
                <Avatar src={o.avatar} name={o.name} />
                <span className="truncate">{o.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LibraryFilters({ streamers, games, streamer, game }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [s, setS] = useState(streamer);
  const [g, setG] = useState(game);

  const apply = () => {
    const q = new URLSearchParams();
    if (s) q.set("streamer", s);
    if (g) q.set("jogo", g);
    const qs = q.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <StreamerSelect options={streamers} value={s} onChange={setS} />
      <select value={g} onChange={(e) => setG(e.target.value)} className={field}>
        <option value="">Todos os jogos</option>
        {games.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <Button size="sm" variant="primary" onClick={apply}>
        Aplicar
      </Button>
      {(streamer || game) && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setS("");
            setG("");
            router.push(pathname);
          }}
        >
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
