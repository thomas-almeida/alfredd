"use client";

import { useEffect, useState } from "react";

const MIN_SECONDS = 2 * 60;
const MAX_SECONDS = 5 * 60;

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function LpNotificationTicker() {
  const [remaining, setRemaining] = useState(MIN_SECONDS);

  useEffect(() => {
    const initialSeconds = Math.floor(Math.random() * (MAX_SECONDS - MIN_SECONDS + 1)) + MIN_SECONDS;
    setRemaining(initialSeconds);

    const timer = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (remaining === 0) window.location.reload();
  }, [remaining]);

  return (
    <aside className="lp-notification-ticker" aria-label="Tempo restante da página">
      <div className="lp-notification-track">
        <span className="lp-notification-item">
          <span className="lp-notification-dot" aria-hidden="true" />
          Essa página vai sair do ar em <strong>{formatCountdown(remaining)}</strong>
        </span>
      </div>
    </aside>
  );
}
