import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** Estado vazio padrão (loading/vazio/erro tratados de forma coerente). */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-12 px-4 border border-dashed border-border-strong rounded-lg bg-surface/50">
      {icon && (
        <span
          className="inline-flex items-center justify-center w-11 h-11 rounded-md bg-surface-2 text-muted mb-2"
          aria-hidden
        >
          <Icon name={icon} width={22} height={22} />
        </span>
      )}
      <h3 className="text-base">{title}</h3>
      {description && (
        <p className="text-muted max-w-[42ch] text-[13px]">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
