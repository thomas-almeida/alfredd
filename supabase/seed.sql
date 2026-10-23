-- Clipes — Seed de desenvolvimento.
-- ATENÇÃO: todos os registros são DEMONSTRATIVOS e identificados com o prefixo
-- "[DEMO]" / twitch_id "demo-*". Não representam dados reais da Twitch e não
-- devem ir para produção. ClipScore NÃO é semeado (evita score inventado).

insert into games (twitch_id, name, box_art_url) values
  ('demo-gta6', '[DEMO] Grand Theft Auto VI', null),
  ('demo-justchatting', '[DEMO] Just Chatting', null)
on conflict (twitch_id) do nothing;

insert into streamers (twitch_id, login, display_name, thumbnail_url) values
  ('demo-streamer-1', 'demo_streamer_um', '[DEMO] Streamer Um', null)
on conflict (twitch_id) do nothing;

insert into clips (twitch_id, url, embed_url, title, game_id, twitch_created_at, latest_view_count)
select
  'demo-clip-1',
  'https://www.twitch.tv/_',
  'https://clips.twitch.tv/embed?clip=demo-clip-1',
  '[DEMO] Momento de exemplo',
  (select id from games where twitch_id = 'demo-gta6'),
  now() - interval '3 hours',
  1234
on conflict (twitch_id) do nothing;
