-- Ankunftszeiten pro Haltestelle, wo sie von der Abfahrt abweichen: {stopId: minuten}
alter table public.trips add column if not exists arrivals jsonb not null default '{}'::jsonb;
