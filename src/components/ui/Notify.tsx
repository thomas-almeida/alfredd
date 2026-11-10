"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type NotifyProps = {
    message: string;
    initialDelay?: number;
    repeatDelay?: number;
    onOpen?: () => void;
};

export default function Notify({
    message,
    initialDelay = 5000,
    repeatDelay = 4000,
    onOpen,
}: NotifyProps) {
    const [visible, setVisible] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        timerRef.current = setTimeout(() => setVisible(true), initialDelay);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [initialDelay]);

    function dismissNotification() {
        setVisible(false);

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setVisible(true), repeatDelay);
    }

    function openNotification() {
        dismissNotification();
        onOpen?.();
    }

    if (!visible) return null;

    return (
        <div className="lp-notify" role="status" aria-live="polite">
            <div
                className="lp-notify-card"
                role={onOpen ? "button" : undefined}
                tabIndex={onOpen ? 0 : undefined}
                onClick={openNotification}
                onKeyDown={(event) => {
                    if (onOpen && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        openNotification();
                    }
                }}
            >
                <Image
                    src="/ghost.jpeg"
                    alt="Notificação"
                    width={48}
                    height={48}
                    className="lp-notify-avatar"
                />
                <div className="lp-notify-copy">
                    <div className="lp-notify-heading">
                        <span className="lp-notify-app">Alfredd</span>
                        <span className="lp-notify-time">agora</span>
                    </div>
                    <p className="lp-notify-message">{message}</p>
                </div>
                <button
                    type="button"
                    className="lp-notify-close"
                    onClick={(event) => {
                        event.stopPropagation();
                        dismissNotification();
                    }}
                    aria-label="Fechar notificação"
                >
                    ×
                </button>
            </div>
        </div>
    )
}
