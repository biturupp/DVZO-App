-- DVZO-App: Fahrzeugstammdaten. «name» ist die Betriebsnummer.
alter table public.vehicles add column if not exists owner text not null default '';
alter table public.vehicles add column if not exists brand text not null default '';
alter table public.vehicles add column if not exists model text not null default '';
alter table public.vehicles add column if not exists plate text not null default '';
alter table public.vehicles add column if not exists last_inspection date;
alter table public.vehicles add column if not exists active boolean not null default true;
alter table public.vehicles add column if not exists updated_at timestamptz not null default now();
