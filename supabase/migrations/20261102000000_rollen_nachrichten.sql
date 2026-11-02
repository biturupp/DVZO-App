-- DVZO-App: Rollen Fahrer/in, Disposition und Administration; Sofortnachrichten.
--   fahrer: eigene Dienste und Zählungen
--   dispo:  zusätzlich Linien, Fahrpläne, Dienstpläne, Fahrzeuge, alle Zählungen
--   admin:  alles, inkl. Benutzerverwaltung

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'dispo', 'fahrer'));
alter table public.profiles add column if not exists active boolean not null default true;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active);
$$;

-- Darf disponieren (Disposition oder Administration).
create or replace function public.is_dispo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'dispo') and active);
$$;

-- Stammdaten, Fahrpläne und Dienste: Disposition und Administration
drop policy if exists "vehicles verwalten" on public.vehicles;
create policy "vehicles verwalten" on public.vehicles for all to authenticated using (public.is_dispo()) with check (public.is_dispo());
drop policy if exists "lines verwalten" on public.lines;
create policy "lines verwalten" on public.lines for all to authenticated using (public.is_dispo()) with check (public.is_dispo());
drop policy if exists "trips verwalten" on public.trips;
create policy "trips verwalten" on public.trips for all to authenticated using (public.is_dispo()) with check (public.is_dispo());
drop policy if exists "calendars verwalten" on public.calendars;
create policy "calendars verwalten" on public.calendars for all to authenticated using (public.is_dispo()) with check (public.is_dispo());

drop policy if exists "duties lesen" on public.duties;
create policy "duties lesen" on public.duties for select to authenticated using (driver_id = auth.uid() or public.is_dispo());
drop policy if exists "duties verwalten" on public.duties;
create policy "duties verwalten" on public.duties for all to authenticated using (public.is_dispo()) with check (public.is_dispo());

drop policy if exists "counts lesen" on public.counts;
create policy "counts lesen" on public.counts for select to authenticated using (user_id = auth.uid() or public.is_dispo());
drop policy if exists "counts erfassen" on public.counts;
create policy "counts erfassen" on public.counts for insert to authenticated
  with check (
    public.is_dispo()
    or (user_id = auth.uid()
        and exists (select 1 from public.duties d where d.id = duty_id and d.driver_id = auth.uid()))
  );
drop policy if exists "counts korrigieren" on public.counts;
create policy "counts korrigieren" on public.counts for delete to authenticated
  using (public.is_dispo() or (user_id = auth.uid() and date = current_date));
drop policy if exists "counts verwalten" on public.counts;
create policy "counts verwalten" on public.counts for update to authenticated using (public.is_dispo()) with check (public.is_dispo());

-- Profile (Name, Rolle) ändert nur die Administration. Anlegen und Löschen von Konten
-- läuft über die Netlify-Funktion «users» mit dem geheimen Service-Schlüssel.
-- (Die Regel «profiles verwalten» aus dem Grundschema nutzt bereits is_admin().)

-- Sofortnachrichten: erscheinen bei der empfangenden Person als Popup.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_recipient on public.messages (recipient_id, read_at);
alter table public.messages enable row level security;

create policy "messages lesen" on public.messages for select to authenticated
  using (recipient_id = auth.uid() or sender_id = auth.uid() or public.is_admin());
create policy "messages senden" on public.messages for insert to authenticated
  with check (public.is_dispo() and sender_id = auth.uid());
create policy "messages gelesen" on public.messages for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
-- Empfänger/innen dürfen nur «gelesen» setzen, nicht den Text ändern
revoke update on public.messages from authenticated;
grant select, insert on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

-- Live-Zustellung (Supabase Realtime)
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; when undefined_object then null;
end $$;
