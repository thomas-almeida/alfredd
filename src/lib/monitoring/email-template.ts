import "server-only";

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);
}

export function monitoringEmail(params: {
  title: string;
  creator: string;
  game: string;
  thumbnail: string;
  clipUrl: string;
  editorUrl: string;
}) {
  const title = escapeHtml(params.title || "Novo clipe");
  const creator = escapeHtml(params.creator);
  const game = escapeHtml(params.game || "Twitch");
  return `<!doctype html><html><body style="margin:0;background:#0b0b0d;color:#f5f5f5;font-family:Arial,sans-serif;padding:32px 16px">
    <div style="max-width:560px;margin:auto;background:#151518;border:1px solid #29292f;border-radius:12px;overflow:hidden">
      ${params.thumbnail ? `<img src="${escapeHtml(params.thumbnail)}" alt="" style="display:block;width:100%;height:auto">` : ""}
      <div style="padding:24px"><p style="margin:0 0 8px;color:#b7f34a;font-size:13px;font-weight:bold">NOVO CONTEÚDO MONITORADO</p>
        <h1 style="font-size:22px;line-height:1.25;margin:0 0 12px">${title}</h1>
        <p style="color:#b8b8c0;margin:0 0 20px">${creator} · ${game}</p>
        <a href="${escapeHtml(params.editorUrl)}" style="display:inline-block;background:#b7f34a;color:#111;padding:12px 16px;border-radius:7px;text-decoration:none;font-weight:bold;margin-right:8px">Abrir no editor</a>
        <a href="${escapeHtml(params.clipUrl)}" style="display:inline-block;color:#b7f34a;padding:12px 0;text-decoration:none">Assistir na Twitch →</a>
      </div>
    </div><p style="max-width:560px;margin:16px auto;color:#777;font-size:12px">Você recebeu este alerta porque monitora este jogo ou criador no Alfredd.</p>
  </body></html>`;
}
