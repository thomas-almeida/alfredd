import { LP_NOTIFICATIONS } from "./lpNotifications";

export function LpNotificationTicker() {
  const messages = [...LP_NOTIFICATIONS, ...LP_NOTIFICATIONS];

  return (
    <aside className="lp-notification-ticker" aria-label="Atividade recente de criadores">
      <div className="lp-notification-track">
        {messages.map((message, index) => (
          <span className="lp-notification-item" key={`${message}-${index}`}>
            <span className="lp-notification-dot" aria-hidden="true" />
            {message}
          </span>
        ))}
      </div>
    </aside>
  );
}
