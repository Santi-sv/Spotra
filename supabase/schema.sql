create extension if not exists postgis;
create extension if not exists pgcrypto;

do $$
begin
  create type public.spotra_account_type as enum ('rider', 'store', 'brand', 'organizer', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.spotra_place_type as enum ('skatepark', 'street_spot', 'store', 'event_venue');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.spotra_status as enum ('pending', 'approved', 'rejected', 'archived');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  account_type public.spotra_account_type not null default 'rider',
  full_name text not null,
  username text unique,
  email text,
  phone text,
  country_code char(2) not null default 'UY',
  city text,
  discipline text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  google_place_id text unique,
  type public.spotra_place_type not null,
  status public.spotra_status not null default 'pending',
  source text not null default 'spotra',
  name text not null,
  description text,
  country_code char(2) not null,
  city text,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  location geography(point, 4326) generated always as (
    st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
  ) stored,
  image_url text,
  rating numeric(2,1),
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.place_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references public.profiles(id) on delete set null,
  candidate_google_place_id text,
  type public.spotra_place_type not null,
  status public.spotra_status not null default 'pending',
  name text not null,
  description text,
  country_code char(2),
  city text,
  address text,
  latitude double precision,
  longitude double precision,
  image_url text,
  google_payload jsonb not null default '{}'::jsonb,
  reviewer_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  status public.spotra_status not null default 'pending',
  title text not null,
  description text,
  starts_at timestamptz not null,
  organizer_id uuid references public.profiles(id) on delete set null,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists places_location_gix on public.places using gist(location);
create index if not exists places_status_type_idx on public.places(status, type);
create index if not exists place_submissions_status_idx on public.place_submissions(status, created_at desc);
create index if not exists events_place_starts_idx on public.events(place_id, starts_at);

alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.place_submissions enable row level security;
alter table public.events enable row level security;

drop policy if exists "users can read their own profile" on public.profiles;
create policy "users can read their own profile"
  on public.profiles for select
  using (
    auth.uid() = id
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "users can insert their own profile" on public.profiles;
create policy "users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "approved places are public" on public.places;
create policy "approved places are public"
  on public.places for select
  using (status = 'approved');

drop policy if exists "admins can manage places" on public.places;
create policy "admins can manage places"
  on public.places for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "authenticated users can submit places" on public.place_submissions;
create policy "authenticated users can submit places"
  on public.place_submissions for insert
  with check (auth.role() = 'authenticated' and submitted_by = auth.uid());

drop policy if exists "users can read their own submissions" on public.place_submissions;
create policy "users can read their own submissions"
  on public.place_submissions for select
  using (
    submitted_by = auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "admins can update submissions" on public.place_submissions;
create policy "admins can update submissions"
  on public.place_submissions for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "approved events are public" on public.events;
create policy "approved events are public"
  on public.events for select
  using (status = 'approved');

drop policy if exists "admins can manage events" on public.events;
create policy "admins can manage events"
  on public.events for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
