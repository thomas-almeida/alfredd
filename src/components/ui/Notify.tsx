"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type NotifyProps = {
    messages: readonly NotifyMessage[];
    initialDelay?: number;
    displayDuration?: number;
    repeatDelay?: number;
    onOpen?: () => void;
};

export type NotifyMessage = {
    picture: string;
    name: string;
    message: string;
};

export default function Notify({
    messages = [],
    initialDelay = 5000,
    displayDuration = 5000,
    repeatDelay = 250,
    onOpen,
}: NotifyProps) {
    const [visible, setVisible] = useState(false);
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        if (!messages.length) return;

        const delay = visible
            ? displayDuration
            : messageIndex === 0
                ? initialDelay
                : repeatDelay;
        const timer = setTimeout(() => {
            if (visible) {
                setVisible(false);
                setMessageIndex((index) => (index + 1) % messages.length);
            } else {
                setVisible(true);
            }
        }, delay);

        return () => clearTimeout(timer);
    }, [displayDuration, initialDelay, messageIndex, messages.length, repeatDelay, visible]);

    function dismissNotification() {
        setVisible(false);
        setMessageIndex((index) => (index + 1) % messages.length);
    }

    function openNotification() {
        dismissNotification();
        onOpen?.();
    }

    if (!visible || !messages.length) return null;

    const currentMessage = messages[messageIndex % messages.length];
    if (!currentMessage) return null;

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
                    src={currentMessage.picture}
                    alt={currentMessage.name}
                    width={48}
                    height={48}
                    className="lp-notify-avatar"
                />
                <div className="lp-notify-copy">
                    <div className="lp-notify-heading">
                        <span className="lp-notify-app">{currentMessage.name}</span>
                        <span className="lp-notify-time">agora</span>
                    </div>
                    <p className="lp-notify-message">{currentMessage.message}</p>
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
