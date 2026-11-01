-- DVZO-App: Grundschema mit Zugriffsregeln (Row Level Security)
-- Fahrer/innen sehen ihre eigenen Dienste und Zählungen, die Disposition (admin) sieht und bearbeitet alles.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  role text not null default 'fahrer' check (role in ('admin', 'fahrer')),
  created_at timestamptz not null default now()
);

-- Prüft, ob die angemeldete Person zur Disposition gehört.
-- security definer, damit die Prüfung nicht selbst an den Regeln von profiles hängen bleibt.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Neues Konto (z. B. per Einladung) bekommt automatisch ein Profil als Fahrer/in.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.vehicles (
  id text primary key,
  name text not null,
  seats int
);

create table public.lines (
  id text primary key,
  name text not null,
  route text not null default '',
  color text not null default '#1d6b50',
  days text not null default '',
  -- Haltestellen in Hinrichtung: [{id, name, lat, lon, radius}]
  stops jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.trips (
  id text primary key,
  line_id text not null references public.lines (id) on delete cascade,
  dir text not null check (dir in ('H', 'R')),
  -- Zeit pro Haltestelle in Minuten ab Mitternacht: {stopId: minuten}
  times jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index trips_line_id on public.trips (line_id);

create table public.duties (
  id text primary key,
  date date not null,
  driver_id uuid not null references public.profiles (id),
  vehicle_id text references public.vehicles (id),
  -- Tätigkeiten: [{id, type, start, end, note, tripId}]
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create index duties_date on public.duties (date);
create index duties_driver on public.duties (driver_id, date);

create table public.counts (
  id text primary key,
  date date not null,
  duty_id text not null references public.duties (id) on delete restrict,
  trip_id text not null,
  line_id text not null,
  stop_id text not null,
  stop_name text not null,
  idx int not null,
  adults_in int not null default 0 check (adults_in >= 0),
  adults_out int not null default 0 check (adults_out >= 0),
  kids_in int not null default 0 check (kids_in >= 0),
  kids_out int not null default 0 check (kids_out >= 0),
  time numeric not null,
  delay numeric,
  user_id uuid not null references public.profiles (id) default auth.uid(),
  vehicle_id text,
  emptied boolean not null default false,
  created_at timestamptz not null default now()
);
create index counts_date on public.counts (date);
create index counts_line_date on public.counts (line_id, date);

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.lines enable row level security;
alter table public.trips enable row level security;
alter table public.duties enable row level security;
alter table public.counts enable row level security;

-- Profile: alle Angemeldeten sehen Namen (für Dienstpläne), nur die Disposition ändert Rollen.
create policy "profiles lesen" on public.profiles for select to authenticated using (true);
create policy "profiles verwalten" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Stammdaten: alle lesen, Disposition schreibt.
create policy "vehicles lesen" on public.vehicles for select to authenticated using (true);
create policy "vehicles verwalten" on public.vehicles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "lines lesen" on public.lines for select to authenticated using (true);
create policy "lines verwalten" on public.lines for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "trips lesen" on public.trips for select to authenticated using (true);
create policy "trips verwalten" on public.trips for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Dienste: eigene lesen, Disposition alles.
create policy "duties lesen" on public.duties for select to authenticated
  using (driver_id = auth.uid() or public.is_admin());
create policy "duties verwalten" on public.duties for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Zählungen: Fahrer/innen erfassen nur auf eigenen Diensten und unter eigenem Namen,
-- dürfen eigene Einträge vom selben Tag löschen (Korrektur), sehen nur eigene. Disposition alles.
create policy "counts lesen" on public.counts for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "counts erfassen" on public.counts for insert to authenticated
  with check (
    public.is_admin()
    or (user_id = auth.uid()
        and exists (select 1 from public.duties d where d.id = duty_id and d.driver_id = auth.uid()))
  );
create policy "counts korrigieren" on public.counts for delete to authenticated
  using (public.is_admin() or (user_id = auth.uid() and date = current_date));
create policy "counts verwalten" on public.counts for update to authenticated using (public.is_admin()) with check (public.is_admin());
