"use client";

import { Icon } from "@/components/ui/Icon";
import { signOut } from "@/features/auth/actions";
import { useAuthModal } from "@/features/auth/AuthModal";

const btn =
  "inline-flex items-center gap-2 text-[13px] font-medium text-muted px-3 py-2 rounded-sm hover:bg-surface-2 hover:text-fg";

export function TopBarAuth({ email }: { email: string | null }) {
  const { openAuth } = useAuthModal();

  if (email) {
    return (
      <>
        <span
          className="text-[13px] text-muted max-w-[180px] truncate"
          title={email}
        >
          {email}
        </span>
        <form action={signOut}>
          <button type="submit" className={btn}>
            Sair
          </button>
        </form>
      </>
    );
  }

  return (
    <button type="button" className={btn} onClick={() => openAuth()}>
      <Icon name="login" width={16} height={16} />
      Entrar
    </button>
  );
}
