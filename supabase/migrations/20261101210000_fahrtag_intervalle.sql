-- Fahrtag-Intervalle (Vorlagen für Verkehrstage) und Kursnummer/Intervall pro Kurs
create table if not exists public.calendars (
  id text primary key,
  name text not null,
  date_from date not null,
  date_to date not null,
  -- Wochentage 1 = Montag … 7 = Sonntag
  weekdays int[] not null default '{}',
  holidays text not null default 'normal' check (holidays in ('normal', 'sunday', 'never', 'only')),
  extra_dates jsonb not null default '[]'::jsonb,
  -- [{from, to}]
  exceptions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.calendars enable row level security;
create policy "calendars lesen" on public.calendars for select to authenticated using (true);
create policy "calendars verwalten" on public.calendars for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.trips add column if not exists number text not null default '';
alter table public.trips add column if not exists calendar_id text references public.calendars (id) on delete set null;
-- falls Migration 20261101200000 noch nicht lief
alter table public.trips add column if not exists arrivals jsonb not null default '{}'::jsonb;
