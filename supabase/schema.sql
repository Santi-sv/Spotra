-- =====================================================================
-- SPOTRA — schema.sql (respaldo de la base real de Supabase)
-- Generado el 18/09/2026 a partir del estado real de producción.
-- Proyecto Supabase: threviqdxzbjsdxbjubm
--
-- Sirve para: respaldo y para recrear la base en un proyecto nuevo.
-- Es idempotente (se puede correr sobre una base existente sin romper nada),
-- pero NO cambia columnas de tablas que ya existen.
--
-- No incluye (viven solo en Supabase): Edge Function send-push (index.ts),
-- secretos VAPID, usuarios de Auth ni los datos de las tablas.
-- =====================================================================

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type public.spotra_account_type as enum ('rider', 'store', 'brand', 'organizer', 'admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.spotra_place_type as enum ('skatepark', 'street_spot', 'store', 'event_venue');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.spotra_status as enum ('pending', 'approved', 'rejected', 'archived');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid not null,
  account_type public.spotra_account_type default 'rider'::spotra_account_type not null,
  full_name text not null,
  username text,
  email text,
  phone text,
  country_code char(2) default 'UY'::bpchar not null,
  city text,
  discipline text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  bio text,
  instagram text,
  tiktok text,
  facebook text,
  constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint profiles_pkey PRIMARY KEY (id),
  constraint profiles_username_key UNIQUE (username)
);

create table if not exists public.places (
  id uuid default gen_random_uuid() not null,
  google_place_id text,
  type public.spotra_place_type not null,
  status public.spotra_status default 'pending'::spotra_status not null,
  source text default 'spotra'::text not null,
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
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  contact_phone text,
  website text,
  instagram text,
  constraint places_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL,
  constraint places_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
  constraint places_google_place_id_key UNIQUE (google_place_id),
  constraint places_pkey PRIMARY KEY (id)
);

create table if not exists public.place_submissions (
  id uuid default gen_random_uuid() not null,
  submitted_by uuid,
  candidate_google_place_id text,
  type public.spotra_place_type not null,
  status public.spotra_status default 'pending'::spotra_status not null,
  name text not null,
  description text,
  country_code char(2),
  city text,
  address text,
  latitude double precision,
  longitude double precision,
  image_url text,
  google_payload jsonb default '{}'::jsonb not null,
  reviewer_notes text,
  created_at timestamptz default now() not null,
  reviewed_at timestamptz,
  contact_phone text,
  website text,
  instagram text,
  constraint place_submissions_pkey PRIMARY KEY (id),
  constraint place_submissions_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES profiles(id) ON DELETE SET NULL
);

create table if not exists public.place_photos (
  id uuid default gen_random_uuid() not null,
  place_id uuid not null,
  url text not null,
  uploaded_by uuid,
  status text default 'pending'::text not null,
  is_cover boolean default false not null,
  created_at timestamptz default now() not null,
  reviewed_at timestamptz,
  constraint place_photos_pkey PRIMARY KEY (id),
  constraint place_photos_place_id_fkey FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE,
  constraint place_photos_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
  constraint place_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id)
);

create table if not exists public.events (
  id uuid default gen_random_uuid() not null,
  place_id uuid not null,
  status public.spotra_status default 'pending'::spotra_status not null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  organizer_id uuid,
  image_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  discipline text default 'todas'::text not null,
  registration_info text,
  prizes text,
  categories text[] default '{}'::text[] not null,
  capacity integer,
  closes_at timestamptz,
  contact_phone text,
  rain_reschedule boolean default false not null,
  constraint events_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES profiles(id) ON DELETE SET NULL,
  constraint events_pkey PRIMARY KEY (id),
  constraint events_place_id_fkey FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
);

create table if not exists public.event_registrations (
  id uuid default gen_random_uuid() not null,
  event_id uuid not null,
  profile_id uuid not null,
  username text,
  categories text[] default '{}'::text[] not null,
  created_at timestamptz default now() not null,
  constraint event_registrations_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  constraint event_registrations_event_id_profile_id_key UNIQUE (event_id, profile_id),
  constraint event_registrations_pkey PRIMARY KEY (id),
  constraint event_registrations_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

create table if not exists public.event_results (
  id uuid default gen_random_uuid() not null,
  event_id uuid not null,
  category text default 'General'::text not null,
  profile_id uuid,
  username text,
  position integer not null,
  discipline text,
  points integer not null,
  created_at timestamptz default now() not null,
  constraint event_results_event_id_category_position_key UNIQUE (event_id, category, "position"),
  constraint event_results_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  constraint event_results_pkey PRIMARY KEY (id),
  constraint event_results_position_check CHECK ((("position" >= 1) AND ("position" <= 3))),
  constraint event_results_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL
);

create table if not exists public.posts (
  id uuid default gen_random_uuid() not null,
  author_id uuid not null,
  username text,
  avatar_url text,
  content text not null,
  image_url text,
  created_at timestamptz default now() not null,
  constraint posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE,
  constraint posts_pkey PRIMARY KEY (id)
);

create table if not exists public.post_likes (
  post_id uuid not null,
  profile_id uuid not null,
  created_at timestamptz default now() not null,
  constraint post_likes_pkey PRIMARY KEY (post_id, profile_id),
  constraint post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  constraint post_likes_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

create table if not exists public.post_comments (
  id uuid default gen_random_uuid() not null,
  post_id uuid not null,
  author_id uuid not null,
  username text,
  content text not null,
  created_at timestamptz default now() not null,
  constraint post_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE,
  constraint post_comments_pkey PRIMARY KEY (id),
  constraint post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() not null,
  profile_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now() not null,
  constraint push_subscriptions_endpoint_key UNIQUE (endpoint),
  constraint push_subscriptions_pkey PRIMARY KEY (id),
  constraint push_subscriptions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

create table if not exists public.waitlist (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  telefono text not null,
  disciplina text,
  origen text default 'landing'::text,
  created_at timestamptz default now() not null,
  pais text,
  prefijo text,
  idioma text,
  tipo text default 'rider'::text,
  marca text,
  constraint waitlist_pkey PRIMARY KEY (id)
);

create table if not exists public.waitlist_settings (
  id integer default 1 not null,
  templates jsonb default '[]'::jsonb not null,
  updated_at timestamptz default now() not null,
  constraint waitlist_settings_pkey PRIMARY KEY (id),
  constraint waitlist_settings_single CHECK ((id = 1))
);

-- ---------------------------------------------------------------------
-- Índices (los de PK y UNIQUE se crean solos con las restricciones)
-- ---------------------------------------------------------------------
create index if not exists event_registrations_event_idx ON public.event_registrations USING btree (event_id);
create index if not exists event_results_event_idx ON public.event_results USING btree (event_id);
create index if not exists event_results_ranking_idx ON public.event_results USING btree (discipline, profile_id);
create index if not exists events_place_starts_idx ON public.events USING btree (place_id, starts_at);
create index if not exists place_photos_place_idx ON public.place_photos USING btree (place_id, status);
create index if not exists place_submissions_status_idx ON public.place_submissions USING btree (status, created_at DESC);
create index if not exists places_location_gix ON public.places USING gist (location);
create index if not exists places_status_type_idx ON public.places USING btree (status, type);
create index if not exists post_comments_post_idx ON public.post_comments USING btree (post_id, created_at);
create index if not exists posts_created_idx ON public.posts USING btree (created_at DESC);
create index if not exists push_subscriptions_profile_idx ON public.push_subscriptions USING btree (profile_id);
create unique index if not exists waitlist_telefono_key ON public.waitlist USING btree (telefono);
-- índices de claves foráneas (24/09/2026)
create index if not exists places_approved_by_idx          on public.places (approved_by);
create index if not exists places_created_by_idx           on public.places (created_by);
create index if not exists place_submissions_submitted_by_idx on public.place_submissions (submitted_by);
create index if not exists place_photos_uploaded_by_idx    on public.place_photos (uploaded_by);
create index if not exists events_organizer_idx            on public.events (organizer_id);
create index if not exists event_registrations_profile_idx on public.event_registrations (profile_id);
create index if not exists event_results_profile_idx       on public.event_results (profile_id);
create index if not exists posts_author_idx                on public.posts (author_id);
create index if not exists post_likes_profile_idx          on public.post_likes (profile_id);
create index if not exists post_comments_author_idx        on public.post_comments (author_id);

-- ---------------------------------------------------------------------
-- Vista del ranking
-- ---------------------------------------------------------------------
create or replace view public.rider_rankings with (security_invoker = true) as
 SELECT discipline,
    profile_id,
    max(username) AS username,
    sum(points) AS total_points,
    count(*) FILTER (WHERE ("position" = 1)) AS golds,
    count(*) AS podiums
   FROM event_results
  WHERE ((discipline IS NOT NULL) AND (profile_id IS NOT NULL))
  GROUP BY discipline, profile_id;

-- ---------------------------------------------------------------------
-- Funciones RPC (SECURITY DEFINER; chequean permisos adentro)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_place_photo(photo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ph public.place_photos; has_cover boolean;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'admin' then raise exception 'no autorizado'; end if;
  select * into ph from public.place_photos where id = photo_id;
  if not found then raise exception 'foto no encontrada'; end if;
  update public.place_photos set status='approved', reviewed_at=now() where id = photo_id;
  select exists(select 1 from public.place_photos where place_id=ph.place_id and is_cover and status='approved') into has_cover;
  if not has_cover then
    update public.place_photos set is_cover=true where id = photo_id;
    update public.places set image_url = ph.url where id = ph.place_id;
  end if;
end; $function$;

CREATE OR REPLACE FUNCTION public.approve_submission(submission_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.place_submissions; new_id uuid;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'admin' then
    raise exception 'no autorizado';
  end if;
  select * into s from public.place_submissions where id = submission_id;
  if not found then raise exception 'envio no encontrado'; end if;
  if s.latitude is null or s.longitude is null then raise exception 'sin coordenadas'; end if;

  insert into public.places (
    google_place_id, type, status, source, name, description,
    country_code, city, address, latitude, longitude, image_url,
    created_by, approved_by, approved_at
  ) values (
    s.candidate_google_place_id, s.type, 'approved', 'community', s.name, s.description,
    coalesce(s.country_code,'UY'), s.city, s.address, s.latitude, s.longitude, s.image_url,
    s.submitted_by, auth.uid(), now()
  )
  on conflict (google_place_id) do nothing
  returning id into new_id;

  update public.place_submissions set status='approved', reviewed_at=now() where id = submission_id;
  return new_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.organizer_cancel_event(p_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.events set status = 'archived', updated_at = now()
  where id = p_event_id
    and organizer_id = auth.uid()
    and status in ('pending', 'approved');
  if not found then
    raise exception 'no autorizado';
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.organizer_update_event(p_event_id uuid, p_title text, p_starts_at timestamp with time zone, p_description text, p_discipline text, p_categories text[], p_registration_info text, p_prizes text, p_capacity integer, p_closes_at timestamp with time zone, p_contact_phone text, p_rain boolean, p_place_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.events set
    title = p_title,
    starts_at = p_starts_at,
    description = p_description,
    discipline = coalesce(p_discipline, 'todas'),
    categories = coalesce(p_categories, '{}'),
    registration_info = p_registration_info,
    prizes = p_prizes,
    capacity = p_capacity,
    closes_at = p_closes_at,
    contact_phone = p_contact_phone,
    rain_reschedule = coalesce(p_rain, false),
    place_id = coalesce(p_place_id, place_id),
    updated_at = now()
  where id = p_event_id
    and organizer_id = auth.uid()
    and status in ('pending', 'approved');
  if not found then
    raise exception 'no autorizado';
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.reject_place_photo(photo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'admin' then raise exception 'no autorizado'; end if;
  update public.place_photos set status='rejected', reviewed_at=now() where id = photo_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.reject_submission(submission_id uuid, notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'admin' then
    raise exception 'no autorizado';
  end if;
  update public.place_submissions
    set status='rejected', reviewed_at=now(), reviewer_notes=coalesce(notes, reviewer_notes)
    where id = submission_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.save_event_results(p_event_id uuid, p_category text, p_first uuid, p_second uuid, p_third uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_event record;
  v_role text;
  v_cat text;
  v_ids uuid[];
  v_pid uuid;
  v_pos int;
  v_user text;
  v_disc text;
  v_prof_disc text;
begin
  select * into v_event from events where id = p_event_id;
  if v_event is null then raise exception 'evento inexistente'; end if;
  v_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  if v_event.organizer_id is distinct from auth.uid() and v_role <> 'admin' then
    raise exception 'no autorizado';
  end if;
  if v_event.starts_at > now() then raise exception 'el evento todavia no paso'; end if;
  if p_first is null then raise exception 'falta el primer puesto'; end if;
  if p_first = p_second or p_first = p_third or (p_second is not null and p_second = p_third) then
    raise exception 'riders repetidos en el podio';
  end if;

  v_cat := coalesce(nullif(trim(p_category), ''), 'General');
  delete from event_results where event_id = p_event_id and category = v_cat;

  v_ids := array[p_first, p_second, p_third];
  for v_pos in 1..3 loop
    v_pid := v_ids[v_pos];
    if v_pid is null then continue; end if;

    select username into v_user
    from event_registrations
    where event_id = p_event_id and profile_id = v_pid;
    if v_user is null then
      select username into v_user from event_registrations
      where event_id = p_event_id and profile_id = v_pid;
      if not found then raise exception 'rider no inscripto en el evento'; end if;
    end if;

    if v_event.discipline is not null and v_event.discipline <> 'todas' then
      v_disc := v_event.discipline;
    else
      select lower(coalesce(discipline, '')) into v_prof_disc from profiles where id = v_pid;
      v_disc := case
        when v_prof_disc like '%bmx%' or v_prof_disc like '%bike%' then 'bmx'
        when v_prof_disc like '%roll%' then 'rollers'
        when v_prof_disc like '%skate%' then 'skate'
        else null
      end;
    end if;

    insert into event_results (event_id, category, profile_id, username, position, discipline, points)
    values (
      p_event_id, v_cat, v_pid, coalesce(v_user, 'rider'), v_pos, v_disc,
      case v_pos when 1 then 100 when 2 then 60 else 30 end
    );
  end loop;
end $function$;

CREATE OR REPLACE FUNCTION public.set_place_cover(photo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ph public.place_photos;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'admin' then raise exception 'no autorizado'; end if;
  select * into ph from public.place_photos where id = photo_id;
  if not found then raise exception 'foto no encontrada'; end if;
  if ph.status <> 'approved' then raise exception 'la foto no esta aprobada'; end if;
  update public.place_photos set is_cover = (id = photo_id) where place_id = ph.place_id;
  update public.places set image_url = ph.url where id = ph.place_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.set_submission_location(submission_id uuid, lat double precision, lng double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- solo administradores (rol en app_metadata del JWT)
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'Solo un administrador puede fijar la ubicación.';
  end if;

  update public.place_submissions
     set latitude = lat,
         longitude = lng
   where id = submission_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.event_registrations enable row level security;
alter table public.event_results enable row level security;
alter table public.events enable row level security;
alter table public.place_photos enable row level security;
alter table public.place_submissions enable row level security;
alter table public.places enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.posts enable row level security;
alter table public.profiles enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.waitlist enable row level security;
alter table public.waitlist_settings enable row level security;

-- ---------------------------------------------------------------------
-- Políticas (se borran y recrean para que el archivo sea re-ejecutable)
-- ---------------------------------------------------------------------
drop policy if exists "admins manage registrations" on public.event_registrations;
create policy "admins manage registrations" on public.event_registrations
  for all
  using (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  with check (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

drop policy if exists "authenticated can read registrations" on public.event_registrations;
create policy "authenticated can read registrations" on public.event_registrations
  for select
  using (((select auth.role()) = 'authenticated'::text));

drop policy if exists "users cancel their registration" on public.event_registrations;
create policy "users cancel their registration" on public.event_registrations
  for delete
  using ((profile_id = (select auth.uid())));

drop policy if exists "users register themselves" on public.event_registrations;
create policy "users register themselves" on public.event_registrations
  for insert
  with check ((((select auth.role()) = 'authenticated'::text) AND (profile_id = (select auth.uid()))));

drop policy if exists "results are public" on public.event_results;
create policy "results are public" on public.event_results
  for select
  using (true);

drop policy if exists "admins can manage events" on public.events;
create policy "admins can manage events" on public.events
  for all
  using (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  with check (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

drop policy if exists "approved events are public" on public.events;
create policy "approved events are public" on public.events
  for select
  using ((status = 'approved'::spotra_status));

drop policy if exists "authenticated users can create events" on public.events;
create policy "authenticated users can create events" on public.events
  for insert
  with check ((((select auth.role()) = 'authenticated'::text) AND (organizer_id = (select auth.uid())) AND (status = 'pending'::spotra_status)));

drop policy if exists "registered users can read their events" on public.events;
create policy "registered users can read their events" on public.events
  for select
  using ((EXISTS ( SELECT 1
   FROM event_registrations r
  WHERE ((r.event_id = events.id) AND (r.profile_id = (select auth.uid()))))));

drop policy if exists "users can read their own events" on public.events;
create policy "users can read their own events" on public.events
  for select
  using ((organizer_id = (select auth.uid())));

drop policy if exists "insert own photos" on public.place_photos;
create policy "insert own photos" on public.place_photos
  for insert
  to authenticated
  with check (((uploaded_by = (select auth.uid())) AND (status = 'pending'::text)));

drop policy if exists "read approved photos" on public.place_photos;
create policy "read approved photos" on public.place_photos
  for select
  using (((status = 'approved'::text) OR (uploaded_by = (select auth.uid())) OR (COALESCE((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text)));

drop policy if exists "admins can update submissions" on public.place_submissions;
create policy "admins can update submissions" on public.place_submissions
  for update
  using (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  with check (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

drop policy if exists "authenticated users can submit places" on public.place_submissions;
create policy "authenticated users can submit places" on public.place_submissions
  for insert
  with check ((((select auth.role()) = 'authenticated'::text) AND (submitted_by = (select auth.uid()))));

drop policy if exists "users can read their own submissions" on public.place_submissions;
create policy "users can read their own submissions" on public.place_submissions
  for select
  using (((submitted_by = (select auth.uid())) OR ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));

drop policy if exists "admins can manage places" on public.places;
create policy "admins can manage places" on public.places
  for all
  using (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  with check (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

drop policy if exists "approved places are public" on public.places;
create policy "approved places are public" on public.places
  for select
  using ((status = 'approved'::spotra_status));

drop policy if exists "author or admin deletes comments" on public.post_comments;
create policy "author or admin deletes comments" on public.post_comments
  for delete
  using (((author_id = (select auth.uid())) OR ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));

drop policy if exists "comments are public" on public.post_comments;
create policy "comments are public" on public.post_comments
  for select
  using (true);

drop policy if exists "users comment as themselves" on public.post_comments;
create policy "users comment as themselves" on public.post_comments
  for insert
  with check ((((select auth.role()) = 'authenticated'::text) AND (author_id = (select auth.uid()))));

drop policy if exists "likes are public" on public.post_likes;
create policy "likes are public" on public.post_likes
  for select
  using (true);

drop policy if exists "users like as themselves" on public.post_likes;
create policy "users like as themselves" on public.post_likes
  for insert
  with check ((((select auth.role()) = 'authenticated'::text) AND (profile_id = (select auth.uid()))));

drop policy if exists "users remove their likes" on public.post_likes;
create policy "users remove their likes" on public.post_likes
  for delete
  using ((profile_id = (select auth.uid())));

drop policy if exists "author or admin deletes posts" on public.posts;
create policy "author or admin deletes posts" on public.posts
  for delete
  using (((author_id = (select auth.uid())) OR ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));

drop policy if exists "posts are public" on public.posts;
create policy "posts are public" on public.posts
  for select
  using (true);

drop policy if exists "users create their posts" on public.posts;
create policy "users create their posts" on public.posts
  for insert
  with check ((((select auth.role()) = 'authenticated'::text) AND (author_id = (select auth.uid()))));

drop policy if exists "users can insert their own profile" on public.profiles;
create policy "users can insert their own profile" on public.profiles
  for insert
  with check (((select auth.uid()) = id));

drop policy if exists "users can read their own profile" on public.profiles;
create policy "users can read their own profile" on public.profiles
  for select
  using ((((select auth.uid()) = id) OR ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile" on public.profiles
  for update
  using (((select auth.uid()) = id))
  with check (((select auth.uid()) = id));

drop policy if exists "users create their subscriptions" on public.push_subscriptions;
create policy "users create their subscriptions" on public.push_subscriptions
  for insert
  with check ((((select auth.role()) = 'authenticated'::text) AND (profile_id = (select auth.uid()))));

drop policy if exists "users delete their subscriptions" on public.push_subscriptions;
create policy "users delete their subscriptions" on public.push_subscriptions
  for delete
  using (((profile_id = (select auth.uid())) OR ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));

drop policy if exists "users read their subscriptions" on public.push_subscriptions;
create policy "users read their subscriptions" on public.push_subscriptions
  for select
  using (((profile_id = (select auth.uid())) OR ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));

drop policy if exists "waitlist_delete_admin" on public.waitlist;
create policy "waitlist_delete_admin" on public.waitlist
  for delete
  to authenticated
  using ((COALESCE((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text));

drop policy if exists "waitlist_insert_public" on public.waitlist;
create policy "waitlist_insert_public" on public.waitlist
  for insert
  to anon,authenticated
  with check ((((char_length(nombre) >= 2) AND (char_length(nombre) <= 60)) AND ((char_length(telefono) >= 6) AND (char_length(telefono) <= 25)) AND (COALESCE(char_length(marca), 0) <= 80) AND (COALESCE(tipo, 'rider'::text) = ANY (ARRAY['rider'::text, 'marca'::text]))));

drop policy if exists "waitlist_select_admin" on public.waitlist;
create policy "waitlist_select_admin" on public.waitlist
  for select
  to authenticated
  using ((COALESCE((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text));

drop policy if exists "waitlist_settings_admin" on public.waitlist_settings;
create policy "waitlist_settings_admin" on public.waitlist_settings
  for all
  to authenticated
  using ((COALESCE((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text))
  with check ((COALESCE((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text));

drop policy if exists "auth upload place-images" on storage.objects;
create policy "auth upload place-images" on storage.objects
  for insert
  to authenticated
  with check ((bucket_id = 'place-images'::text));

-- ---------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-images', 'place-images', true, 5242880, array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Market C2C (listings) — agregado 18/09/2026
-- ---------------------------------------------------------------------

create table if not exists public.listings (
  id uuid default gen_random_uuid() not null,
  seller_id uuid not null,
  username text,
  whatsapp text not null,
  title text not null,
  description text,
  category text default 'otros'::text not null,
  condition text default 'bueno'::text not null,
  price numeric(12,2) not null,
  currency text default 'UYU'::text not null,
  city text,
  latitude double precision,
  longitude double precision,
  photos text[] default '{}'::text[] not null,
  status public.spotra_status default 'pending'::spotra_status not null,
  sold boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint listings_pkey primary key (id),
  constraint listings_seller_id_fkey foreign key (seller_id) references public.profiles(id) on delete cascade,
  constraint listings_title_check check (char_length(title) between 1 and 120),
  constraint listings_description_check check (description is null or char_length(description) <= 2000),
  constraint listings_whatsapp_check check (char_length(whatsapp) between 6 and 30),
  constraint listings_category_check check (category = any (array['tablas','ruedas','bicis','protecciones','ropa','otros'])),
  constraint listings_condition_check check (condition = any (array['nuevo','como-nuevo','bueno','con-detalles'])),
  constraint listings_currency_check check (currency = any (array['UYU','USD','ARS','BRL'])),
  constraint listings_price_check check (price >= 0),
  constraint listings_photos_check check (cardinality(photos) <= 3)
);

create index if not exists listings_public_idx on public.listings using btree (status, sold, created_at desc);
create index if not exists listings_seller_idx on public.listings using btree (seller_id);

alter table public.listings enable row level security;

-- Explorar: todos ven lo aprobado y no vendido
drop policy if exists "approved listings are public" on public.listings;
create policy "approved listings are public" on public.listings
  for select
  using (status = 'approved'::spotra_status and sold = false);

-- Mis publicaciones: el vendedor ve todas las suyas (pendientes, vendidas, rechazadas)
drop policy if exists "sellers read their listings" on public.listings;
create policy "sellers read their listings" on public.listings
  for select
  using (seller_id = (select auth.uid()));

-- Publicar: solo como uno mismo, nace pendiente y sin vender
drop policy if exists "sellers create listings" on public.listings;
create policy "sellers create listings" on public.listings
  for insert
  with check ((select auth.role()) = 'authenticated'::text and seller_id = (select auth.uid()) and status = 'pending'::spotra_status and sold = false);

-- Eliminar: el vendedor o el admin
drop policy if exists "seller or admin deletes listings" on public.listings;
create policy "seller or admin deletes listings" on public.listings
  for delete
  using (seller_id = (select auth.uid()) or coalesce((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text);

-- Moderación: el admin ve y edita todo (aprobar / rechazar)
drop policy if exists "admins manage listings" on public.listings;
create policy "admins manage listings" on public.listings
  for all
  using (coalesce((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text)
  with check (coalesce((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text);

-- Marcar vendido: solo el vendedor (el vendedor no puede editar nada más)
create or replace function public.mark_listing_sold(p_listing_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update public.listings set sold = true, updated_at = now()
  where id = p_listing_id and seller_id = auth.uid();
  if not found then
    raise exception 'no autorizado';
  end if;
end $function$;

-- ---------------------------------------------------------------------
-- Agregado 21/09/2026 · lista de usuarios admin
-- ---------------------------------------------------------------------
create or replace function public.admin_list_users()
 returns table (
   id uuid, full_name text, username text, email text, phone text, city text,
   country_code text, discipline text, instagram text, account_type text,
   created_at timestamptz, last_sign_in_at timestamptz, has_profile boolean
 )
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
#variable_conflict use_column
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'admin' then
    raise exception 'no autorizado';
  end if;
  return query
    select u.id, p.full_name, p.username, coalesce(u.email, p.email)::text, p.phone, p.city,
           p.country_code::text, p.discipline, p.instagram, coalesce(p.account_type::text, 'rider'),
           u.created_at, u.last_sign_in_at, (p.id is not null)
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end $function$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- ---------------------------------------------------------------------
-- Agregado 21/09/2026 · borrado de cuentas
-- ---------------------------------------------------------------------
-- 1) Fotos: si se borra el usuario, la foto queda en el spot sin autor
--    (antes no tenía ON DELETE y bloqueaba el borrado)
alter table public.place_photos drop constraint if exists place_photos_uploaded_by_fkey;
alter table public.place_photos
  add constraint place_photos_uploaded_by_fkey
  foreign key (uploaded_by) references public.profiles(id) on delete set null;

-- 2) El rider borra SU propia cuenta. Un admin no puede borrarse por acá.
create or replace function public.delete_my_account()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'no autorizado'; end if;
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin' then
    raise exception 'una cuenta admin no se puede borrar desde la app';
  end if;
  delete from auth.users where id = v_uid;
end $function$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 3) El admin borra la cuenta de otro usuario (nunca la propia ni la de otro admin).
create or replace function public.admin_delete_user(p_user_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_role text;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'admin' then
    raise exception 'no autorizado';
  end if;
  if p_user_id = auth.uid() then raise exception 'no podés borrar tu propia cuenta'; end if;
  select coalesce(raw_app_meta_data ->> 'role','') into v_role from auth.users where id = p_user_id;
  if not found then raise exception 'usuario no encontrado'; end if;
  if v_role = 'admin' then raise exception 'no se puede borrar a otro admin'; end if;
  delete from auth.users where id = p_user_id;
end $function$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Agregado 21/09/2026 · Security Advisor
-- ---------------------------------------------------------------------
-- 1) rider_rankings: la vista pasa a respetar la RLS de quien consulta.
--    event_results ya es de lectura pública, así que el ranking sigue igual.
alter view public.rider_rankings set (security_invoker = true);

-- 2) spatial_ref_sys (tabla interna de PostGIS): nadie de afuera puede modificarla.
--    La lectura se mantiene porque PostGIS la usa.
revoke insert, update, delete, truncate, references, trigger
  on public.spatial_ref_sys from anon, authenticated;

-- ---------------------------------------------------------------------
-- Agregado 22/09/2026 · blindaje admin paso 1
-- ---------------------------------------------------------------------
-- 1) Disparador: si alguien intenta guardarse como admin sin tener el rol real,
--    se guarda como rider. No corta el registro, solo lo degrada.
create or replace function public.enforce_account_type()
 returns trigger
 language plpgsql
 security invoker
 set search_path to 'public'
as $function$
begin
  if new.account_type::text = 'admin'
     and coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'admin' then
    new.account_type := 'rider';
  end if;
  return new;
end $function$;

drop trigger if exists profiles_account_type_guard on public.profiles;
create trigger profiles_account_type_guard
  before insert or update on public.profiles
  for each row execute function public.enforce_account_type();

revoke execute on function public.enforce_account_type() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Agregado 24/09/2026 · políticas consolidadas (reemplazan a las de arriba)
-- ---------------------------------------------------------------------
-- ===================== event_registrations =====================
drop policy if exists "admins manage registrations" on public.event_registrations;
drop policy if exists "users cancel their registration" on public.event_registrations;
drop policy if exists "users register themselves" on public.event_registrations;
drop policy if exists "authenticated can read registrations" on public.event_registrations;

drop policy if exists "event_registrations_select" on public.event_registrations;
create policy "event_registrations_select" on public.event_registrations
  for select using (
    (select auth.role()) = 'authenticated'
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "event_registrations_insert" on public.event_registrations;
create policy "event_registrations_insert" on public.event_registrations
  for insert with check (
    ((select auth.role()) = 'authenticated' and profile_id = (select auth.uid()))
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "event_registrations_update" on public.event_registrations;
create policy "event_registrations_update" on public.event_registrations
  for update
  using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin')
  with check (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "event_registrations_delete" on public.event_registrations;
create policy "event_registrations_delete" on public.event_registrations
  for delete using (
    profile_id = (select auth.uid())
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

-- ===================== events =====================
drop policy if exists "admins can manage events" on public.events;
drop policy if exists "authenticated users can create events" on public.events;
drop policy if exists "approved events are public" on public.events;
drop policy if exists "registered users can read their events" on public.events;
drop policy if exists "users can read their own events" on public.events;

drop policy if exists "events_select" on public.events;
create policy "events_select" on public.events
  for select using (
    status = 'approved'::spotra_status
    or organizer_id = (select auth.uid())
    or exists (select 1 from public.event_registrations r
                where r.event_id = events.id and r.profile_id = (select auth.uid()))
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "events_insert" on public.events;
create policy "events_insert" on public.events
  for insert with check (
    ((select auth.role()) = 'authenticated'
      and organizer_id = (select auth.uid())
      and status = 'pending'::spotra_status)
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "events_update" on public.events;
create policy "events_update" on public.events
  for update
  using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin')
  with check (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "events_delete" on public.events;
create policy "events_delete" on public.events
  for delete using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

-- ===================== listings =====================
drop policy if exists "admins manage listings" on public.listings;
drop policy if exists "seller or admin deletes listings" on public.listings;
drop policy if exists "sellers create listings" on public.listings;
drop policy if exists "approved listings are public" on public.listings;
drop policy if exists "sellers read their listings" on public.listings;

drop policy if exists "listings_select" on public.listings;
create policy "listings_select" on public.listings
  for select using (
    (status = 'approved'::spotra_status and sold = false)
    or seller_id = (select auth.uid())
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "listings_insert" on public.listings;
create policy "listings_insert" on public.listings
  for insert with check (
    ((select auth.role()) = 'authenticated'
      and seller_id = (select auth.uid())
      and status = 'pending'::spotra_status
      and sold = false)
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "listings_update" on public.listings;
create policy "listings_update" on public.listings
  for update
  using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin')
  with check (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "listings_delete" on public.listings;
create policy "listings_delete" on public.listings
  for delete using (
    seller_id = (select auth.uid())
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

-- ===================== places =====================
drop policy if exists "admins can manage places" on public.places;
drop policy if exists "approved places are public" on public.places;

drop policy if exists "places_select" on public.places;
create policy "places_select" on public.places
  for select using (
    status = 'approved'::spotra_status
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "places_insert" on public.places;
create policy "places_insert" on public.places
  for insert with check (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "places_update" on public.places;
create policy "places_update" on public.places
  for update
  using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin')
  with check (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "places_delete" on public.places;
create policy "places_delete" on public.places
  for delete using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

-- ===================== push_subscriptions =====================
-- Esta política existía en la base pero no en el respaldo.
drop policy if exists "users update their subscriptions" on public.push_subscriptions;
create policy "users update their subscriptions" on public.push_subscriptions
  for update
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Agregado 24/09/2026 · blindaje admin paso 2 (Face ID)
-- ---------------------------------------------------------------------
-- 1) Dispositivos con Face ID de cada admin
create table if not exists public.admin_passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  device_name text not null check (char_length(device_name) between 1 and 40),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists admin_passkeys_user_idx on public.admin_passkeys (user_id);

-- 2) Desafíos de un solo uso (vencen a los 2 minutos)
create table if not exists public.admin_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('register','auth')),
  challenge text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_challenges_user_idx on public.admin_challenges (user_id, purpose);

-- 3) Registro de auditoría de seguridad
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_user_idx on public.admin_audit_log (user_id, action, created_at desc);

-- Cerrar todo acceso desde la app
alter table public.admin_passkeys   enable row level security;
alter table public.admin_challenges enable row level security;
alter table public.admin_audit_log  enable row level security;
revoke all on table public.admin_passkeys   from anon, authenticated;
revoke all on table public.admin_challenges from anon, authenticated;
revoke all on table public.admin_audit_log  from anon, authenticated;


-- =====================================================================
-- SPOTRA · Sesiones de riders (paso 2)
-- Un rider publica que va a rodar en un spot (día, hora de inicio y fin).
-- Se ve en el mapa hasta que termina. Otros riders se suman.
-- Ejecutar UNA vez en Supabase → SQL Editor. Es re-ejecutable.
-- =====================================================================

-- ---------- Tablas ----------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  username text not null,
  avatar_url text,
  discipline text not null default 'todas'
    check (discipline in ('todas','skate','bmx','rollers')),
  note text check (note is null or char_length(note) <= 140),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint sessions_time_check
    check (ends_at > starts_at and ends_at <= starts_at + interval '8 hours')
);

create table if not exists public.session_participants (
  session_id uuid not null references public.sessions(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  username text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  primary key (session_id, profile_id)
);

create index if not exists sessions_ends_at_idx on public.sessions (ends_at);
create index if not exists sessions_place_id_idx on public.sessions (place_id);
create index if not exists sessions_created_by_idx on public.sessions (created_by);
create index if not exists session_participants_profile_id_idx on public.session_participants (profile_id);

-- ---------- Reglas al crear una sesión ----------
-- El autor, usuario y avatar los pone el servidor (no se pueden falsear desde el celular).
create or replace function public.sessions_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_username text;
  v_avatar text;
  v_active int;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  new.created_by := auth.uid();
  new.created_at := now();

  select coalesce(p.username, split_part(p.full_name, ' ', 1)), p.avatar_url
    into v_username, v_avatar
    from public.profiles p where p.id = auth.uid();
  if v_username is null then raise exception 'Completá tu perfil antes de crear una sesión.'; end if;
  new.username := v_username;
  new.avatar_url := v_avatar;

  if not exists (select 1 from public.places pl where pl.id = new.place_id and pl.status = 'approved') then
    raise exception 'El spot no existe o no está aprobado.';
  end if;
  if new.starts_at < now() - interval '15 minutes' then raise exception 'La sesión no puede empezar en el pasado.'; end if;
  if new.starts_at > now() + interval '7 days' then raise exception 'Solo podés crear sesiones hasta 7 días adelante.'; end if;

  select count(*) into v_active from public.sessions s
    where s.created_by = auth.uid() and s.ends_at > now();
  if v_active >= 3 then raise exception 'Ya tenés 3 sesiones activas. Esperá a que termine alguna.'; end if;

  return new;
end;
$$;

drop trigger if exists sessions_before_insert on public.sessions;
create trigger sessions_before_insert
  before insert on public.sessions
  for each row execute function public.sessions_before_insert();

-- ---------- Reglas al sumarse ----------
create or replace function public.session_participants_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_username text;
  v_avatar text;
  v_owner uuid;
  v_ends timestamptz;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  new.profile_id := auth.uid();
  new.created_at := now();

  select s.created_by, s.ends_at into v_owner, v_ends
    from public.sessions s where s.id = new.session_id;
  if v_owner is null then raise exception 'La sesión no existe.'; end if;
  if v_ends <= now() then raise exception 'Esta sesión ya terminó.'; end if;
  if v_owner = auth.uid() then raise exception 'Ya sos el organizador de esta sesión.'; end if;

  select coalesce(p.username, split_part(p.full_name, ' ', 1)), p.avatar_url
    into v_username, v_avatar
    from public.profiles p where p.id = auth.uid();
  if v_username is null then raise exception 'Completá tu perfil antes de sumarte.'; end if;
  new.username := v_username;
  new.avatar_url := v_avatar;
  return new;
end;
$$;

drop trigger if exists session_participants_before_insert on public.session_participants;
create trigger session_participants_before_insert
  before insert on public.session_participants
  for each row execute function public.session_participants_before_insert();


-- ---------- Seguridad (RLS) ----------
-- Solo riders logueados ven sesiones, y solo las que no terminaron. Nunca la gente sin cuenta.
alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;
revoke all on table public.sessions from anon;
revoke all on table public.session_participants from anon;
revoke update on table public.sessions from authenticated;
revoke update on table public.session_participants from authenticated;

drop policy if exists "sessions_select" on public.sessions;
create policy "sessions_select" on public.sessions
  for select using (
    ((select auth.role()) = 'authenticated' and ends_at > now())
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "sessions_insert" on public.sessions;
create policy "sessions_insert" on public.sessions
  for insert with check (
    (select auth.role()) = 'authenticated' and created_by = (select auth.uid()));

-- el autor la borra para terminarla antes; el admin modera
drop policy if exists "sessions_delete" on public.sessions;
create policy "sessions_delete" on public.sessions
  for delete using (
    created_by = (select auth.uid())
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "session_participants_select" on public.session_participants;
create policy "session_participants_select" on public.session_participants
  for select using (
    ((select auth.role()) = 'authenticated'
      and exists (select 1 from public.sessions s where s.id = session_id and s.ends_at > now()))
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "session_participants_insert" on public.session_participants;
create policy "session_participants_insert" on public.session_participants
  for insert with check (
    (select auth.role()) = 'authenticated' and profile_id = (select auth.uid()));

-- cada uno se baja solo; el organizador puede sacar a alguien; el admin modera
drop policy if exists "session_participants_delete" on public.session_participants;
create policy "session_participants_delete" on public.session_participants
  for delete using (
    profile_id = (select auth.uid())
    or exists (select 1 from public.sessions s where s.id = session_id and s.created_by = (select auth.uid()))
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');


-- ---------- Lugares importados de OpenStreetMap (25/09/2026) ----------
-- Datos de Brasil y Argentina: ver osm-brasil-argentina.sql (© colaboradores de OpenStreetMap, ODbL).
alter table public.places add column if not exists osm_id text;
create unique index if not exists places_osm_id_key on public.places (osm_id);


-- =====================================================================
-- SPOTRA · Fecha de nacimiento + Reportar y bloquear
-- Ejecutar UNA vez en Supabase → SQL Editor. Es re-ejecutable.
-- =====================================================================

-- ---------- Fecha de nacimiento ----------
-- Privada (el perfil solo lo ve su dueño). Se pide una sola vez y después no se puede cambiar
-- (solo el admin), para que nadie la ajuste para saltarse límites de edad.
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles drop constraint if exists profiles_birth_date_check;
alter table public.profiles add constraint profiles_birth_date_check
  check (birth_date is null or birth_date >= date '1920-01-01');

create or replace function public.profiles_lock_birth_date()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.birth_date is not distinct from old.birth_date then return new; end if;
  if coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin' then return new; end if;
  if old.birth_date is not null then
    raise exception 'La fecha de nacimiento ya está guardada. Escribinos si hay un error.';
  end if;
  if new.birth_date > (current_date - interval '8 years')::date then
    raise exception 'Revisá la fecha de nacimiento.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_lock_birth_date on public.profiles;
create trigger profiles_lock_birth_date
  before update of birth_date on public.profiles
  for each row execute function public.profiles_lock_birth_date();

-- ¿Es mayor de 18? (para funciones solo +18, como la ubicación en tiempo real)
create or replace function public.is_adult(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.birth_date <= (current_date - interval '18 years')::date
                   from public.profiles p where p.id = uid), false);
$$;
revoke all on function public.is_adult(uuid) from public, anon;
grant execute on function public.is_adult(uuid) to authenticated;

-- ---------- Reportes ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','listing','session','user')),
  target_id text not null check (char_length(target_id) <= 80),
  target_user uuid references public.profiles(id) on delete set null,
  target_name text check (target_name is null or char_length(target_name) <= 120),
  reason text not null check (reason in ('spam','acoso','inapropiado','estafa','peligroso','otro')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  constraint reports_once unique (reporter_id, target_type, target_id)
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);

create or replace function public.reports_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare v_count int;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  new.reporter_id := auth.uid();
  new.status := 'open';
  new.created_at := now();
  if new.target_user = auth.uid() then raise exception 'No podés reportarte a vos mismo.'; end if;
  select count(*) into v_count from public.reports r
    where r.reporter_id = auth.uid() and r.created_at > now() - interval '1 day';
  if v_count >= 20 then raise exception 'Llegaste al límite de reportes por hoy.'; end if;
  return new;
end;
$$;

drop trigger if exists reports_before_insert on public.reports;
create trigger reports_before_insert
  before insert on public.reports
  for each row execute function public.reports_before_insert();

alter table public.reports enable row level security;
revoke all on table public.reports from anon;

drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports
  for insert with check ((select auth.role()) = 'authenticated' and reporter_id = (select auth.uid()));

drop policy if exists "reports_select" on public.reports;
create policy "reports_select" on public.reports
  for select using (
    reporter_id = (select auth.uid())
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_update_admin" on public.reports
  for update using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin')
  with check (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "reports_delete_admin" on public.reports;
create policy "reports_delete_admin" on public.reports
  for delete using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

-- ---------- Bloqueos ----------
-- Cada rider maneja su propia lista. El bloqueado no se entera.
create table if not exists public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  blocked_name text check (blocked_name is null or char_length(blocked_name) <= 120),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;
revoke all on table public.blocks from anon;
revoke update on table public.blocks from authenticated;

drop policy if exists "blocks_select_own" on public.blocks;
create policy "blocks_select_own" on public.blocks
  for select using (blocker_id = (select auth.uid()));

drop policy if exists "blocks_insert_own" on public.blocks;
create policy "blocks_insert_own" on public.blocks
  for insert with check ((select auth.role()) = 'authenticated' and blocker_id = (select auth.uid()));

drop policy if exists "blocks_delete_own" on public.blocks;
create policy "blocks_delete_own" on public.blocks
  for delete using (blocker_id = (select auth.uid()));


-- =====================================================================
-- SPOTRA · Seguir riders
-- Ejecutar UNA vez en Supabase → SQL Editor. Es re-ejecutable.
-- =====================================================================
create table if not exists public.follows (
  follower_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  follower_name text,
  followed_name text,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint follows_not_self check (follower_id <> followed_id)
);
create index if not exists follows_followed_idx on public.follows (followed_id);

-- Los nombres los pone el servidor (desde profiles), no el celular.
create or replace function public.follows_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_count int;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  new.follower_id := auth.uid();
  new.created_at := now();
  if new.followed_id = auth.uid() then raise exception 'No podés seguirte a vos mismo.'; end if;
  select count(*) into v_count from public.follows f
    where f.follower_id = auth.uid() and f.created_at > now() - interval '1 day';
  if v_count >= 200 then raise exception 'Llegaste al límite de riders seguidos por hoy.'; end if;
  select coalesce(p.username, split_part(p.full_name, ' ', 1)) into new.follower_name from public.profiles p where p.id = auth.uid();
  select coalesce(p.username, split_part(p.full_name, ' ', 1)) into new.followed_name from public.profiles p where p.id = new.followed_id;
  if new.followed_name is null then raise exception 'Ese rider no existe.'; end if;
  return new;
end;
$$;
revoke all on function public.follows_before_insert() from public, anon, authenticated;

drop trigger if exists follows_before_insert on public.follows;
create trigger follows_before_insert
  before insert on public.follows
  for each row execute function public.follows_before_insert();

alter table public.follows enable row level security;
revoke all on table public.follows from anon;
revoke update on table public.follows from authenticated;

-- cada uno ve a quién sigue y quién lo sigue
drop policy if exists "follows_select_own" on public.follows;
create policy "follows_select_own" on public.follows
  for select using (follower_id = (select auth.uid()) or followed_id = (select auth.uid()));

drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own" on public.follows
  for insert with check ((select auth.role()) = 'authenticated' and follower_id = (select auth.uid()));

-- dejar de seguir; y cada uno puede sacar a un seguidor
drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own" on public.follows
  for delete using (follower_id = (select auth.uid()) or followed_id = (select auth.uid()));


-- =====================================================================
-- SPOTRA · Avisos de sesiones (ubicación del rider + registro de avisos)
-- Lo usan spotra-location.js (la zona de cada rider) y la Edge Function session-push.
-- Ejecutar UNA vez en Supabase → SQL Editor. Es re-ejecutable.
-- =====================================================================

-- ---------- Zona / ubicación de cada rider (privada: solo la ve su dueño) ----------
create table if not exists public.rider_locations (
  profile_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  mode text not null default 'off' check (mode in ('live','zone','off')),
  latitude double precision,
  longitude double precision,
  radius_km int not null default 10 check (radius_km in (5,10,25)),
  lang text not null default 'es' check (lang in ('es','pt','en')),
  tz text check (tz is null or char_length(tz) <= 64),
  updated_at timestamptz not null default now(),
  constraint rider_locations_coords check (
    mode = 'off' or (latitude between -90 and 90 and longitude between -180 and 180))
);
create index if not exists rider_locations_geo_idx on public.rider_locations (latitude, longitude) where mode <> 'off';

-- Reglas: "mientras uso la app" solo +18, coordenadas redondeadas a ~1 km, el dueño lo pone el servidor.
create or replace function public.rider_locations_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  if tg_op = 'INSERT' then new.profile_id := auth.uid();
  elsif new.profile_id <> old.profile_id then raise exception 'No permitido.';
  end if;
  if new.mode = 'live' and not public.is_adult(auth.uid()) then
    raise exception 'La ubicación mientras usás la app es solo para mayores de 18. Podés usar "Solo mi zona".';
  end if;
  if new.mode = 'off' then
    new.latitude := null; new.longitude := null;
  else
    if new.latitude is null or new.longitude is null then raise exception 'Marcá tu zona primero.'; end if;
    new.latitude := round(new.latitude::numeric, 2)::double precision;
    new.longitude := round(new.longitude::numeric, 2)::double precision;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rider_locations_guard on public.rider_locations;
create trigger rider_locations_guard
  before insert or update on public.rider_locations
  for each row execute function public.rider_locations_guard();

alter table public.rider_locations enable row level security;
revoke all on table public.rider_locations from anon;

drop policy if exists "rider_locations_own_select" on public.rider_locations;
create policy "rider_locations_own_select" on public.rider_locations
  for select using (profile_id = (select auth.uid()));
drop policy if exists "rider_locations_own_insert" on public.rider_locations;
create policy "rider_locations_own_insert" on public.rider_locations
  for insert with check ((select auth.role()) = 'authenticated' and profile_id = (select auth.uid()));
drop policy if exists "rider_locations_own_update" on public.rider_locations;
create policy "rider_locations_own_update" on public.rider_locations
  for update using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
drop policy if exists "rider_locations_own_delete" on public.rider_locations;
create policy "rider_locations_own_delete" on public.rider_locations
  for delete using (profile_id = (select auth.uid()));

-- ---------- Una sesión avisa una sola vez ----------
alter table public.sessions add column if not exists notified_at timestamptz;

-- ---------- Registro de avisos (tope diario por rider). Solo lo usa el servidor. ----------
create table if not exists public.session_notifications (
  session_id uuid not null references public.sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, profile_id)
);
create index if not exists session_notifications_profile_idx on public.session_notifications (profile_id, created_at desc);
alter table public.session_notifications enable row level security;
revoke all on table public.session_notifications from anon, authenticated;


-- =====================================================================
-- SPOTRA · Estado del spot en vivo (estilo Waze)
-- Los riders avisan cómo está un spot ahora. Cada aviso vence solo.
-- Ejecutar UNA vez en Supabase → SQL Editor. Es re-ejecutable.
-- =====================================================================
create table if not exists public.spot_status (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  status text not null check (status in ('ok','mojado','lleno','echan','cerrado','obras')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists spot_status_place_idx on public.spot_status (place_id, expires_at desc);

-- Duración de cada estado y límites anti-spam los pone el servidor.
create or replace function public.spot_status_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare v_day int;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  new.created_by := auth.uid();
  new.created_at := now();
  new.expires_at := now() + case new.status
    when 'ok' then interval '3 hours'
    when 'mojado' then interval '3 hours'
    when 'lleno' then interval '2 hours'
    when 'echan' then interval '4 hours'
    when 'cerrado' then interval '12 hours'
    when 'obras' then interval '3 days'
  end;
  if not exists (select 1 from public.places p where p.id = new.place_id and p.status = 'approved') then
    raise exception 'El spot no existe o no está aprobado.';
  end if;
  if exists (select 1 from public.spot_status s where s.place_id = new.place_id and s.created_by = auth.uid()
             and s.created_at > now() - interval '30 minutes') then
    raise exception 'Ya avisaste el estado de este spot hace poco.';
  end if;
  select count(*) into v_day from public.spot_status s where s.created_by = auth.uid() and s.created_at > now() - interval '1 day';
  if v_day >= 30 then raise exception 'Llegaste al límite de avisos por hoy.'; end if;
  return new;
end;
$$;

drop trigger if exists spot_status_before_insert on public.spot_status;
create trigger spot_status_before_insert
  before insert on public.spot_status
  for each row execute function public.spot_status_before_insert();

alter table public.spot_status enable row level security;
revoke all on table public.spot_status from anon;
revoke update on table public.spot_status from authenticated;

-- solo riders logueados, y solo los avisos vigentes (el admin ve todo)
drop policy if exists "spot_status_select" on public.spot_status;
create policy "spot_status_select" on public.spot_status
  for select using (
    ((select auth.role()) = 'authenticated' and expires_at > now())
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "spot_status_insert" on public.spot_status;
create policy "spot_status_insert" on public.spot_status
  for insert with check ((select auth.role()) = 'authenticated' and created_by = (select auth.uid()));

drop policy if exists "spot_status_delete" on public.spot_status;
create policy "spot_status_delete" on public.spot_status
  for delete using (
    created_by = (select auth.uid())
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');


-- =====================================================================
-- SPOTRA · Menores de 18: cuenta vinculada a un responsable + reglas
-- Edad mínima 13. De 13 a 17: solo mirar hasta vincular a madre, padre o tutor.
-- El responsable habilita Sesiones (solo skateparks), Market (con su WhatsApp) y Avisos por zona.
-- Ejecutar UNA vez en Supabase → SQL Editor. Es re-ejecutable.
-- =====================================================================

-- ---------- Fecha de nacimiento: mínimo 13 años; el responsable puede corregirla al vincular ----------
create or replace function public.profiles_lock_birth_date()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.birth_date is not distinct from old.birth_date then return new; end if;
  if coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin' then return new; end if;
  if current_setting('spotra.guardian_ok', true) = '1' then return new; end if;
  if old.birth_date is not null then
    raise exception 'La fecha de nacimiento ya está guardada. Escribinos si hay un error.';
  end if;
  if new.birth_date > (current_date - interval '13 years')::date then
    raise exception 'SPOTRA es para mayores de 13 años.';
  end if;
  return new;
end;
$$;

-- ---------- Vínculos menor ↔ responsable ----------
create table if not exists public.guardian_links (
  minor_id uuid primary key references public.profiles(id) on delete cascade,
  guardian_id uuid references public.profiles(id) on delete set null,
  minor_name text,
  guardian_name text,
  code text unique,
  code_expires_at timestamptz,
  status text not null default 'pending' check (status in ('pending','active')),
  allow_sessions boolean not null default false,
  allow_market boolean not null default false,
  allow_zone boolean not null default false,
  guardian_whatsapp text check (guardian_whatsapp is null or char_length(guardian_whatsapp) <= 30),
  created_at timestamptz not null default now(),
  linked_at timestamptz,
  constraint guardian_links_not_self check (guardian_id is null or guardian_id <> minor_id)
);
create index if not exists guardian_links_guardian_idx on public.guardian_links (guardian_id);

create table if not exists public.guardian_attempts (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists guardian_attempts_idx on public.guardian_attempts (profile_id, created_at desc);

alter table public.guardian_links enable row level security;
alter table public.guardian_attempts enable row level security;
revoke all on table public.guardian_links from anon;
revoke insert, update, delete on table public.guardian_links from authenticated;
revoke all on table public.guardian_attempts from anon, authenticated;

-- cada uno ve su vínculo (como menor o como responsable). Los cambios solo por las funciones de abajo.
drop policy if exists "guardian_links_select" on public.guardian_links;
create policy "guardian_links_select" on public.guardian_links
  for select using (minor_id = (select auth.uid()) or guardian_id = (select auth.uid())
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

-- ---------- Reglas de edad ----------
create or replace function public.is_minor(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.birth_date > (current_date - interval '18 years')::date
                   from public.profiles p where p.id = uid), false);
$$;

-- what: 'basic' (participar), 'adult', 'sessions', 'market', 'zone'
create or replace function public.guardian_allows(uid uuid, what text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_birth date; l public.guardian_links%rowtype;
begin
  if uid is null then return false; end if;
  select p.birth_date into v_birth from public.profiles p where p.id = uid;
  if v_birth is null then return false; end if;                               -- primero la fecha de nacimiento
  if v_birth <= (current_date - interval '18 years')::date then return true; end if;   -- adulto
  if what = 'adult' then return false; end if;
  select * into l from public.guardian_links g where g.minor_id = uid and g.status = 'active';
  if not found then return false; end if;                                      -- menor sin responsable: solo mirar
  return case what
    when 'basic' then true
    when 'sessions' then l.allow_sessions
    when 'market' then l.allow_market
    when 'zone' then l.allow_zone
    else false end;
end;
$$;

revoke all on function public.is_minor(uuid) from public, anon;
revoke all on function public.guardian_allows(uuid, text) from public, anon;
grant execute on function public.is_minor(uuid) to authenticated, service_role;
grant execute on function public.guardian_allows(uuid, text) to authenticated, service_role;

-- ---------- Funciones para el menor y el responsable ----------
create or replace function public.guardian_create_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_code text; v_name text;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  if not public.is_minor(auth.uid()) then raise exception 'Solo las cuentas de menores necesitan un responsable.'; end if;
  if exists (select 1 from public.guardian_links g where g.minor_id = auth.uid() and g.status = 'active') then
    raise exception 'Ya tenés un responsable vinculado.';
  end if;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  select coalesce(p.username, split_part(p.full_name, ' ', 1)) into v_name from public.profiles p where p.id = auth.uid();
  insert into public.guardian_links (minor_id, minor_name, code, code_expires_at, status)
    values (auth.uid(), v_name, v_code, now() + interval '48 hours', 'pending')
  on conflict (minor_id) do update
    set code = excluded.code, code_expires_at = excluded.code_expires_at, minor_name = excluded.minor_name;
  return v_code;
end;
$$;

create or replace function public.guardian_accept(p_code text, p_birth date, p_whatsapp text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare l public.guardian_links%rowtype; v_fails int; v_name text; v_wa text;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'error', 'Tenés que iniciar sesión.'); end if;
  if not public.is_adult(auth.uid()) then
    return json_build_object('ok', false, 'error', 'El responsable tiene que ser mayor de 18 y tener su fecha de nacimiento cargada.');
  end if;
  select count(*) into v_fails from public.guardian_attempts a where a.profile_id = auth.uid() and a.created_at > now() - interval '1 hour';
  if v_fails >= 8 then return json_build_object('ok', false, 'error', 'Demasiados intentos. Probá en una hora.'); end if;
  select * into l from public.guardian_links g
    where g.code = upper(trim(coalesce(p_code, ''))) and g.status = 'pending' and g.code_expires_at > now();
  if not found then
    insert into public.guardian_attempts (profile_id) values (auth.uid());
    return json_build_object('ok', false, 'error', 'El código no existe o venció. Pedile uno nuevo.');
  end if;
  if l.minor_id = auth.uid() then return json_build_object('ok', false, 'error', 'No podés ser tu propio responsable.'); end if;
  if p_birth is null or p_birth > (current_date - interval '13 years')::date then
    return json_build_object('ok', false, 'error', 'SPOTRA es para mayores de 13 años.');
  end if;
  if p_birth <= (current_date - interval '18 years')::date then
    return json_build_object('ok', false, 'error', 'Con esa fecha es mayor de 18 y no necesita responsable. Revisá la fecha.');
  end if;
  v_wa := nullif(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9+]', '', 'g'), '');
  select coalesce(p.username, split_part(p.full_name, ' ', 1)) into v_name from public.profiles p where p.id = auth.uid();
  update public.guardian_links
    set guardian_id = auth.uid(), guardian_name = v_name, status = 'active', linked_at = now(),
        code = null, code_expires_at = null, guardian_whatsapp = v_wa
    where minor_id = l.minor_id;
  perform set_config('spotra.guardian_ok', '1', true);   -- el responsable confirma la fecha de nacimiento
  update public.profiles set birth_date = p_birth where id = l.minor_id;
  perform set_config('spotra.guardian_ok', '', true);    -- se apaga enseguida: solo vale para este cambio
  return json_build_object('ok', true, 'minor', l.minor_name);
end;
$$;

create or replace function public.guardian_set(p_minor uuid, p_sessions boolean, p_market boolean, p_zone boolean, p_whatsapp text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_wa text;
begin
  if not exists (select 1 from public.guardian_links g where g.minor_id = p_minor and g.guardian_id = auth.uid() and g.status = 'active') then
    raise exception 'No sos responsable de esta cuenta.';
  end if;
  v_wa := nullif(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9+]', '', 'g'), '');
  if coalesce(p_market, false) and v_wa is null then raise exception 'Para habilitar el Market cargá tu WhatsApp.'; end if;
  update public.guardian_links
    set allow_sessions = coalesce(p_sessions, false), allow_market = coalesce(p_market, false),
        allow_zone = coalesce(p_zone, false), guardian_whatsapp = v_wa
    where minor_id = p_minor;
  if not coalesce(p_zone, false) then
    update public.rider_locations set mode = 'off', latitude = null, longitude = null where profile_id = p_minor;
  end if;
  if v_wa is not null then
    update public.listings set whatsapp = v_wa where seller_id = p_minor;
  end if;
end;
$$;

create or replace function public.guardian_unlink(p_minor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.guardian_links g where g.minor_id = p_minor
                 and (g.guardian_id = auth.uid() or g.minor_id = auth.uid())) then
    raise exception 'No permitido.';
  end if;
  delete from public.guardian_links where minor_id = p_minor;
  update public.rider_locations set mode = 'off', latitude = null, longitude = null where profile_id = p_minor;
end;
$$;

create or replace function public.my_guardian_status()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_birth date; l public.guardian_links%rowtype; v_wards json;
begin
  if auth.uid() is null then return null; end if;
  select p.birth_date into v_birth from public.profiles p where p.id = auth.uid();
  select * into l from public.guardian_links g where g.minor_id = auth.uid();
  select coalesce(json_agg(json_build_object('minor_id', g.minor_id, 'minor_name', g.minor_name,
           'allow_sessions', g.allow_sessions, 'allow_market', g.allow_market, 'allow_zone', g.allow_zone,
           'whatsapp', g.guardian_whatsapp) order by g.linked_at), '[]'::json)
    into v_wards from public.guardian_links g where g.guardian_id = auth.uid() and g.status = 'active';
  return json_build_object(
    'birth_set', v_birth is not null,
    'minor', coalesce(v_birth > (current_date - interval '18 years')::date, false),
    'linked', coalesce(l.status = 'active', false),
    'code', case when l.status = 'pending' and l.code_expires_at > now() then l.code end,
    'code_expires_at', case when l.status = 'pending' then l.code_expires_at end,
    'guardian_name', l.guardian_name,
    'allow_sessions', coalesce(l.allow_sessions, false),
    'allow_market', coalesce(l.allow_market, false),
    'allow_zone', coalesce(l.allow_zone, false),
    'wards', v_wards);
end;
$$;

revoke all on function public.guardian_create_code() from public, anon;
revoke all on function public.guardian_accept(text, date, text) from public, anon;
revoke all on function public.guardian_set(uuid, boolean, boolean, boolean, text) from public, anon;
revoke all on function public.guardian_unlink(uuid) from public, anon;
revoke all on function public.my_guardian_status() from public, anon;
grant execute on function public.guardian_create_code() to authenticated;
grant execute on function public.guardian_accept(text, date, text) to authenticated;
grant execute on function public.guardian_set(uuid, boolean, boolean, boolean, text) to authenticated;
grant execute on function public.guardian_unlink(uuid) to authenticated;
grant execute on function public.my_guardian_status() to authenticated;

-- ---------- Market: los productos de un menor muestran el WhatsApp del responsable ----------
create or replace function public.listings_minor_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_wa text;
begin
  if public.is_minor(new.seller_id) then
    select g.guardian_whatsapp into v_wa from public.guardian_links g where g.minor_id = new.seller_id and g.status = 'active';
    if v_wa is null then raise exception 'Tu responsable tiene que cargar su WhatsApp para que puedas publicar.'; end if;
    new.whatsapp := v_wa;
  end if;
  return new;
end;
$$;
revoke all on function public.listings_minor_whatsapp() from public, anon, authenticated;

drop trigger if exists listings_minor_whatsapp on public.listings;
create trigger listings_minor_whatsapp
  before insert or update of whatsapp on public.listings
  for each row execute function public.listings_minor_whatsapp();

-- ---------- Reglas en el servidor (políticas restrictivas: se suman a las que ya existen) ----------
-- admin siempre puede. Los demás, según su edad y lo que habilitó su responsable.
do $$
declare t text;
begin
  foreach t in array array['posts','post_comments','post_likes','follows','spot_status','place_submissions','place_photos','event_registrations']
  loop
    execute format('drop policy if exists "minors_basic" on public.%I', t);
    execute format($p$create policy "minors_basic" on public.%I as restrictive for insert to authenticated
      with check (public.guardian_allows((select auth.uid()), 'basic')
        or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin')$p$, t);
  end loop;
end $$;

drop policy if exists "minors_adult" on public.events;
create policy "minors_adult" on public.events as restrictive for insert to authenticated
  with check (public.guardian_allows((select auth.uid()), 'adult')
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "minors_market" on public.listings;
create policy "minors_market" on public.listings as restrictive for insert to authenticated
  with check (public.guardian_allows((select auth.uid()), 'market')
    or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

-- sesiones de menores: solo si el responsable las habilitó y solo en skateparks
drop policy if exists "minors_sessions" on public.sessions;
create policy "minors_sessions" on public.sessions as restrictive for insert to authenticated
  with check (
    coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin'
    or (public.guardian_allows((select auth.uid()), 'sessions')
        and (not public.is_minor((select auth.uid()))
             or exists (select 1 from public.places p where p.id = place_id and p.type = 'skatepark'))));

drop policy if exists "minors_session_join" on public.session_participants;
create policy "minors_session_join" on public.session_participants as restrictive for insert to authenticated
  with check (
    coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin'
    or (public.guardian_allows((select auth.uid()), 'sessions')
        and (not public.is_minor((select auth.uid()))
             or exists (select 1 from public.sessions s join public.places p on p.id = s.place_id
                        where s.id = session_id and p.type = 'skatepark'))));

-- avisos por zona de menores: solo si el responsable los habilitó
drop policy if exists "minors_zone_insert" on public.rider_locations;
create policy "minors_zone_insert" on public.rider_locations as restrictive for insert to authenticated
  with check (mode = 'off' or public.guardian_allows((select auth.uid()), 'zone'));
drop policy if exists "minors_zone_update" on public.rider_locations;
create policy "minors_zone_update" on public.rider_locations as restrictive for update to authenticated
  using (true)
  with check (mode = 'off' or public.guardian_allows((select auth.uid()), 'zone'));


-- =====================================================================
-- SPOTRA · Foto de perfil y portada
-- Las imágenes se guardan en el bucket place-images, carpeta profiles/<id del rider>/.
-- Ejecutar UNA vez en Supabase → SQL Editor. Es re-ejecutable.
-- =====================================================================
alter table public.profiles add column if not exists cover_url text;

-- Solo se aceptan imágenes subidas a SPOTRA, dentro de la carpeta del propio rider.
create or replace function public.profiles_check_images()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare base text := 'https://threviqdxzbjsdxbjubm.supabase.co/storage/v1/object/public/place-images/profiles/' || new.id::text || '/';
begin
  if new.avatar_url is distinct from old.avatar_url and new.avatar_url is not null
     and (left(new.avatar_url, length(base)) <> base or char_length(new.avatar_url) > 300) then
    raise exception 'Foto de perfil no válida.';
  end if;
  if new.cover_url is distinct from old.cover_url and new.cover_url is not null
     and (left(new.cover_url, length(base)) <> base or char_length(new.cover_url) > 300) then
    raise exception 'Portada no válida.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_check_images on public.profiles;
create trigger profiles_check_images
  before update of avatar_url, cover_url on public.profiles
  for each row execute function public.profiles_check_images();

-- Cada rider solo puede subir y borrar dentro de su propia carpeta profiles/<su id>/
drop policy if exists "profiles folder upload" on storage.objects;
create policy "profiles folder upload" on storage.objects as restrictive
  for insert to authenticated
  with check (bucket_id <> 'place-images' or name not like 'profiles/%'
              or (storage.foldername(name))[2] = (select auth.uid())::text);

drop policy if exists "profiles folder delete" on storage.objects;
create policy "profiles folder delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'place-images' and name like 'profiles/%'
         and (storage.foldername(name))[2] = (select auth.uid())::text);


-- =====================================================================
-- SPOTRA · Perfil de rider (estilo Instagram) + foto actualizada en todas sus publicaciones
-- Ejecutar UNA vez en Supabase → SQL Editor. Es re-ejecutable.
-- =====================================================================

-- Datos públicos de un rider (solo para usuarios logueados; nunca email, teléfono ni fecha de nacimiento).
create or replace function public.rider_profile(p_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare r public.profiles%rowtype;
begin
  if auth.uid() is null then return null; end if;
  if exists (select 1 from public.blocks b
             where (b.blocker_id = auth.uid() and b.blocked_id = p_id)
                or (b.blocker_id = p_id and b.blocked_id = auth.uid())) then
    return null;
  end if;
  select * into r from public.profiles p where p.id = p_id;
  if not found then return null; end if;
  return json_build_object(
    'id', r.id,
    'username', r.username,
    'name', r.full_name,
    'avatar_url', r.avatar_url,
    'cover_url', r.cover_url,
    'bio', r.bio,
    'discipline', r.discipline,
    'country_code', r.country_code,
    'city', r.city,
    'instagram', r.instagram,
    'tiktok', r.tiktok,
    'facebook', r.facebook,
    'followers', (select count(*) from public.follows f where f.followed_id = r.id),
    'following', (select count(*) from public.follows f where f.follower_id = r.id),
    'posts', (select count(*) from public.posts po where po.author_id = r.id),
    'is_me', r.id = auth.uid());
end;
$$;
revoke all on function public.rider_profile(uuid) from public, anon;
grant execute on function public.rider_profile(uuid) to authenticated;

-- Cuando un rider cambia su foto, se actualiza en sus publicaciones y sesiones.
create or replace function public.profiles_sync_avatar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.avatar_url is distinct from old.avatar_url then
    update public.posts set avatar_url = new.avatar_url where author_id = new.id;
    update public.sessions set avatar_url = new.avatar_url where created_by = new.id and ends_at > now();
    update public.session_participants set avatar_url = new.avatar_url where profile_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.profiles_sync_avatar() from public, anon, authenticated;

drop trigger if exists profiles_sync_avatar on public.profiles;
create trigger profiles_sync_avatar
  after update of avatar_url on public.profiles
  for each row execute function public.profiles_sync_avatar();

-- Una vez: poner la foto actual en las publicaciones viejas.
update public.posts po set avatar_url = pr.avatar_url
  from public.profiles pr
  where pr.id = po.author_id and pr.avatar_url is not null and po.avatar_url is distinct from pr.avatar_url;


-- ---------------------------------------------------------------------
-- Agregado 29/09/2026 · funciones de aprobación y eventos (copiadas de Supabase)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_place_photo(photo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ph public.place_photos; has_cover boolean;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'admin' then raise exception 'no autorizado'; end if;
  select * into ph from public.place_photos where id = photo_id;
  if not found then raise exception 'foto no encontrada'; end if;
  update public.place_photos set status='approved', reviewed_at=now() where id = photo_id;
  select exists(select 1 from public.place_photos where place_id=ph.place_id and is_cover and status='approved') into has_cover;
  if not has_cover then
    update public.place_photos set is_cover=true where id = photo_id;
    update public.places set image_url = ph.url where id = ph.place_id;
  end if;
end; $function$;

CREATE OR REPLACE FUNCTION public.approve_submission(submission_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.place_submissions; new_id uuid;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'admin' then
    raise exception 'no autorizado';
  end if;
  select * into s from public.place_submissions where id = submission_id;
  if not found then raise exception 'envio no encontrado'; end if;
  if s.latitude is null or s.longitude is null then raise exception 'sin coordenadas'; end if;

  insert into public.places (
    google_place_id, type, status, source, name, description,
    country_code, city, address, latitude, longitude, image_url,
    created_by, approved_by, approved_at
  ) values (
    s.candidate_google_place_id, s.type, 'approved', 'community', s.name, s.description,
    coalesce(s.country_code,'UY'), s.city, s.address, s.latitude, s.longitude, s.image_url,
    s.submitted_by, auth.uid(), now()
  )
  on conflict (google_place_id) do nothing
  returning id into new_id;

  update public.place_submissions set status='approved', reviewed_at=now() where id = submission_id;
  return new_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.organizer_cancel_event(p_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.events set status = 'archived', updated_at = now()
  where id = p_event_id
    and organizer_id = auth.uid()
    and status in ('pending', 'approved');
  if not found then
    raise exception 'no autorizado';
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.organizer_update_event(p_event_id uuid, p_title text, p_starts_at timestamp with time zone, p_description text, p_discipline text, p_categories text[], p_registration_info text, p_prizes text, p_capacity integer, p_closes_at timestamp with time zone, p_contact_phone text, p_rain boolean, p_place_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.events set
    title = p_title,
    starts_at = p_starts_at,
    description = p_description,
    discipline = coalesce(p_discipline, 'todas'),
    categories = coalesce(p_categories, '{}'),
    registration_info = p_registration_info,
    prizes = p_prizes,
    capacity = p_capacity,
    closes_at = p_closes_at,
    contact_phone = p_contact_phone,
    rain_reschedule = coalesce(p_rain, false),
    place_id = coalesce(p_place_id, place_id),
    updated_at = now()
  where id = p_event_id
    and organizer_id = auth.uid()
    and status in ('pending', 'approved');
  if not found then
    raise exception 'no autorizado';
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.reject_place_photo(photo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'admin' then raise exception 'no autorizado'; end if;
  update public.place_photos set status='rejected', reviewed_at=now() where id = photo_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.reject_submission(submission_id uuid, notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'admin' then
    raise exception 'no autorizado';
  end if;
  update public.place_submissions
    set status='rejected', reviewed_at=now(), reviewer_notes=coalesce(notes, reviewer_notes)
    where id = submission_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.save_event_results(p_event_id uuid, p_category text, p_first uuid, p_second uuid, p_third uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_event record;
  v_role text;
  v_cat text;
  v_ids uuid[];
  v_pid uuid;
  v_pos int;
  v_user text;
  v_disc text;
  v_prof_disc text;
begin
  select * into v_event from events where id = p_event_id;
  if v_event is null then raise exception 'evento inexistente'; end if;
  v_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  if v_event.organizer_id is distinct from auth.uid() and v_role <> 'admin' then
    raise exception 'no autorizado';
  end if;
  if v_event.starts_at > now() then raise exception 'el evento todavia no paso'; end if;
  if p_first is null then raise exception 'falta el primer puesto'; end if;
  if p_first = p_second or p_first = p_third or (p_second is not null and p_second = p_third) then
    raise exception 'riders repetidos en el podio';
  end if;

  v_cat := coalesce(nullif(trim(p_category), ''), 'General');
  delete from event_results where event_id = p_event_id and category = v_cat;

  v_ids := array[p_first, p_second, p_third];
  for v_pos in 1..3 loop
    v_pid := v_ids[v_pos];
    if v_pid is null then continue; end if;

    select username into v_user
    from event_registrations
    where event_id = p_event_id and profile_id = v_pid;
    if v_user is null then
      select username into v_user from event_registrations
      where event_id = p_event_id and profile_id = v_pid;
      if not found then raise exception 'rider no inscripto en el evento'; end if;
    end if;

    if v_event.discipline is not null and v_event.discipline <> 'todas' then
      v_disc := v_event.discipline;
    else
      select lower(coalesce(discipline, '')) into v_prof_disc from profiles where id = v_pid;
      v_disc := case
        when v_prof_disc like '%bmx%' or v_prof_disc like '%bike%' then 'bmx'
        when v_prof_disc like '%roll%' then 'rollers'
        when v_prof_disc like '%skate%' then 'skate'
        else null
      end;
    end if;

    insert into event_results (event_id, category, profile_id, username, position, discipline, points)
    values (
      p_event_id, v_cat, v_pid, coalesce(v_user, 'rider'), v_pos, v_disc,
      case v_pos when 1 then 100 when 2 then 60 else 30 end
    );
  end loop;
end $function$;

CREATE OR REPLACE FUNCTION public.set_place_cover(photo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ph public.place_photos;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'admin' then raise exception 'no autorizado'; end if;
  select * into ph from public.place_photos where id = photo_id;
  if not found then raise exception 'foto no encontrada'; end if;
  if ph.status <> 'approved' then raise exception 'la foto no esta aprobada'; end if;
  update public.place_photos set is_cover = (id = photo_id) where place_id = ph.place_id;
  update public.places set image_url = ph.url where id = ph.place_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.set_submission_location(submission_id uuid, lat double precision, lng double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- solo administradores (rol en app_metadata del JWT)
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'Solo un administrador puede fijar la ubicación.';
  end if;

  update public.place_submissions
     set latitude = lat,
         longitude = lng
   where id = submission_id;
end;
$function$;


-- =====================================================================
-- SPOTRA · Arreglos del Asesor de seguridad de Supabase (29/09/2026)
-- Ejecutar en Supabase → SQL Editor. Es re-ejecutable.
-- =====================================================================

-- 1) is_adult, is_minor y guardian_allows: antes cualquier usuario logueado podía preguntar
--    por la edad de OTRO rider (por ejemplo, si alguien es menor). Ahora solo responden sobre uno mismo.
--    Las reglas de la app siguen funcionando igual porque siempre preguntan por el propio usuario.
create or replace function public.is_adult(uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- solo sobre uno mismo (o desde el servidor): nadie puede consultar la edad de otro rider
  if uid is distinct from auth.uid() and coalesce(auth.role(), '') <> 'service_role' and session_user <> 'postgres' then return false; end if;
  return coalesce((select p.birth_date <= (current_date - interval '18 years')::date
                   from public.profiles p where p.id = uid), false);
end;
$$;

create or replace function public.is_minor(uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- solo sobre uno mismo (o desde el servidor): nadie puede consultar la edad de otro rider
  if uid is distinct from auth.uid() and coalesce(auth.role(), '') <> 'service_role' and session_user <> 'postgres' then return false; end if;
  return coalesce((select p.birth_date > (current_date - interval '18 years')::date
                   from public.profiles p where p.id = uid), false);
end;
$$;

create or replace function public.guardian_allows(uid uuid, what text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_birth date; l public.guardian_links%rowtype;
begin
  if uid is null then return false; end if;
  -- solo sobre uno mismo (o desde el servidor): nadie puede consultar la edad de otro rider
  if uid is distinct from auth.uid() and coalesce(auth.role(), '') <> 'service_role' and session_user <> 'postgres' then return false; end if;
  select p.birth_date into v_birth from public.profiles p where p.id = uid;
  if v_birth is null then return false; end if;                               -- primero la fecha de nacimiento
  if v_birth <= (current_date - interval '18 years')::date then return true; end if;   -- adulto
  if what = 'adult' then return false; end if;
  select * into l from public.guardian_links g where g.minor_id = uid and g.status = 'active';
  if not found then return false; end if;                                      -- menor sin responsable: solo mirar
  return case what
    when 'basic' then true
    when 'sessions' then l.allow_sessions
    when 'market' then l.allow_market
    when 'zone' then l.allow_zone
    else false end;
end;
$$;

-- 2) Funciones internas de PostGIS que no usa la app: que nadie las llame desde afuera.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'st_estimatedextent'
  loop
    begin
      execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    exception when others then raise notice 'No se pudo cambiar %: %', f.sig, sqlerrm;
    end;
  end loop;
end $$;
