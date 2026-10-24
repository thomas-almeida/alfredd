import type { SVGProps } from "react";

/**
 * Conjunto mínimo de ícones (stroke) desenhados inline para não depender de
 * biblioteca externa e manter coerência de traço com o design system.
 */

const base: SVGProps<SVGSVGElement> = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export type IconName =
  | "compass"
  | "search"
  | "grid"
  | "film"
  | "bookmark"
  | "star"
  | "radar"
  | "bell"
  | "card"
  | "settings"
  | "shield"
  | "login"
  | "chevron-right"
  | "plus"
  | "clock"
  | "eye"
  | "scissors"
  | "trash"
  | "undo"
  | "redo"
  | "zoom-in"
  | "zoom-out"
  | "fit"
  | "expand"
  | "collapse"
  | "play"
  | "pause"
  | "skip-back"
  | "skip-forward"
  | "repeat"
  | "volume"
  | "volume-off"
  | "unlink"
  | "link"
  | "music"
  | "subtitles";

export function Icon({
  name,
  ...props
}: { name: IconName } & SVGProps<SVGSVGElement>) {
  const p = { ...base, ...props };
  switch (name) {
    case "compass":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="m15.5 8.5-2 5-5 2 2-5z" />
        </svg>
      );
    case "search":
      return (
        <svg {...p}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
      );
    case "grid":
      return (
        <svg {...p}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "film":
      return (
        <svg {...p}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
        </svg>
      );
    case "bookmark":
      return (
        <svg {...p}>
          <path d="M6 4h12v16l-6-4-6 4z" />
        </svg>
      );
    case "star":
      return (
        <svg {...p}>
          <path d="m12 3 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9 6.7 19.2l1-5.8L3.5 9.2l5.9-.9z" />
        </svg>
      );
    case "radar":
      return (
        <svg {...p}>
          <path d="M12 3a9 9 0 1 0 9 9" />
          <path d="M12 7a5 5 0 1 0 5 5" />
          <path d="M12 12 19 5" />
        </svg>
      );
    case "bell":
      return (
        <svg {...p}>
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    case "card":
      return (
        <svg {...p}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18" />
        </svg>
      );
    case "settings":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
        </svg>
      );
    case "shield":
      return (
        <svg {...p}>
          <path d="M12 3 5 6v5c0 4 3 7 7 9 4-2 7-5 7-9V6z" />
        </svg>
      );
    case "login":
      return (
        <svg {...p}>
          <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
          <path d="M10 17l5-5-5-5M15 12H3" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...p}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
    case "plus":
      return (
        <svg {...p}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "clock":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "eye":
      return (
        <svg {...p}>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "scissors":
      return (
        <svg {...p}>
          <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M8.1 8.1 20 20M8.1 15.9 20 4" />
        </svg>
      );
    case "trash":
      return (
        <svg {...p}>
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
        </svg>
      );
    case "undo":
      return (
        <svg {...p}>
          <path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" />
        </svg>
      );
    case "redo":
      return (
        <svg {...p}>
          <path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h3" />
        </svg>
      );
    case "zoom-in":
      return (
        <svg {...p}>
          <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4M11 8v6M8 11h6" />
        </svg>
      );
    case "zoom-out":
      return (
        <svg {...p}>
          <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4M8 11h6" />
        </svg>
      );
    case "fit":
      return (
        <svg {...p}>
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      );
    case "expand":
      return (
        <svg {...p}>
          <path d="m18 15-6-6-6 6" />
        </svg>
      );
    case "collapse":
      return (
        <svg {...p}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "play":
      return (
        <svg {...p}>
          <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
        </svg>
      );
    case "pause":
      return (
        <svg {...p}>
          <path d="M8 5v14M16 5v14" strokeWidth="3" />
        </svg>
      );
    case "skip-back":
      return (
        <svg {...p}>
          <path d="M6 5v14M19 5 9 12l10 7z" />
        </svg>
      );
    case "skip-forward":
      return (
        <svg {...p}>
          <path d="M18 5v14M5 5l10 7-10 7z" />
        </svg>
      );
    case "repeat":
      return (
        <svg {...p}>
          <path d="m17 2 4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" />
        </svg>
      );
    case "volume":
      return (
        <svg {...p}>
          <path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      );
    case "volume-off":
      return (
        <svg {...p}>
          <path d="M11 5 6 9H3v6h3l5 4z" /><path d="m16 9 6 6M22 9l-6 6" />
        </svg>
      );
    case "unlink":
      return (
        <svg {...p}>
          <path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 4 8M3 3l18 18" />
        </svg>
      );
    case "link":
      return (
        <svg {...p}>
          <path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" />
        </svg>
      );
    case "music":
      return (
        <svg {...p}>
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
      );
    case "subtitles":
      return (
        <svg {...p}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M6 11h5M13 11h5M6 15h3M11 15h7" />
        </svg>
      );
    default:
      return null;
  }
}
