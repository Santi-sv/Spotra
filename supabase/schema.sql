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

-- ---------------------------------------------------------------------
-- Vista del ranking
-- ---------------------------------------------------------------------
create or replace view public.rider_rankings as
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
  using ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  with check ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

drop policy if exists "authenticated can read registrations" on public.event_registrations;
create policy "authenticated can read registrations" on public.event_registrations
  for select
  using ((auth.role() = 'authenticated'::text));

drop policy if exists "users cancel their registration" on public.event_registrations;
create policy "users cancel their registration" on public.event_registrations
  for delete
  using ((profile_id = auth.uid()));

drop policy if exists "users register themselves" on public.event_registrations;
create policy "users register themselves" on public.event_registrations
  for insert
  with check (((auth.role() = 'authenticated'::text) AND (profile_id = auth.uid())));

drop policy if exists "results are public" on public.event_results;
create policy "results are public" on public.event_results
  for select
  using (true);

drop policy if exists "admins can manage events" on public.events;
create policy "admins can manage events" on public.events
  for all
  using ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  with check ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

drop policy if exists "approved events are public" on public.events;
create policy "approved events are public" on public.events
  for select
  using ((status = 'approved'::spotra_status));

drop policy if exists "authenticated users can create events" on public.events;
create policy "authenticated users can create events" on public.events
  for insert
  with check (((auth.role() = 'authenticated'::text) AND (organizer_id = auth.uid()) AND (status = 'pending'::spotra_status)));

drop policy if exists "registered users can read their events" on public.events;
create policy "registered users can read their events" on public.events
  for select
  using ((EXISTS ( SELECT 1
   FROM event_registrations r
  WHERE ((r.event_id = events.id) AND (r.profile_id = auth.uid())))));

drop policy if exists "users can read their own events" on public.events;
create policy "users can read their own events" on public.events
  for select
  using ((organizer_id = auth.uid()));

drop policy if exists "insert own photos" on public.place_photos;
create policy "insert own photos" on public.place_photos
  for insert
  to authenticated
  with check (((uploaded_by = auth.uid()) AND (status = 'pending'::text)));

drop policy if exists "read approved photos" on public.place_photos;
create policy "read approved photos" on public.place_photos
  for select
  using (((status = 'approved'::text) OR (uploaded_by = auth.uid()) OR (COALESCE(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text)));

drop policy if exists "admins can update submissions" on public.place_submissions;
create policy "admins can update submissions" on public.place_submissions
  for update
  using ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  with check ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

drop policy if exists "authenticated users can submit places" on public.place_submissions;
create policy "authenticated users can submit places" on public.place_submissions
  for insert
  with check (((auth.role() = 'authenticated'::text) AND (submitted_by = auth.uid())));

drop policy if exists "users can read their own submissions" on public.place_submissions;
create policy "users can read their own submissions" on public.place_submissions
  for select
  using (((submitted_by = auth.uid()) OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));

drop policy if exists "admins can manage places" on public.places;
create policy "admins can manage places" on public.places
  for all
  using ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  with check ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

drop policy if exists "approved places are public" on public.places;
create policy "approved places are public" on public.places
  for select
  using ((status = 'approved'::spotra_status));

drop policy if exists "author or admin deletes comments" on public.post_comments;
create policy "author or admin deletes comments" on public.post_comments
  for delete
  using (((author_id = auth.uid()) OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));

drop policy if exists "comments are public" on public.post_comments;
create policy "comments are public" on public.post_comments
  for select
  using (true);

drop policy if exists "users comment as themselves" on public.post_comments;
create policy "users comment as themselves" on public.post_comments
  for insert
  with check (((auth.role() = 'authenticated'::text) AND (author_id = auth.uid())));

drop policy if exists "likes are public" on public.post_likes;
create policy "likes are public" on public.post_likes
  for select
  using (true);

drop policy if exists "users like as themselves" on public.post_likes;
create policy "users like as themselves" on public.post_likes
  for insert
  with check (((auth.role() = 'authenticated'::text) AND (profile_id = auth.uid())));

drop policy if exists "users remove their likes" on public.post_likes;
create policy "users remove their likes" on public.post_likes
  for delete
  using ((profile_id = auth.uid()));

drop policy if exists "author or admin deletes posts" on public.posts;
create policy "author or admin deletes posts" on public.posts
  for delete
  using (((author_id = auth.uid()) OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));

drop policy if exists "posts are public" on public.posts;
create policy "posts are public" on public.posts
  for select
  using (true);

drop policy if exists "users create their posts" on public.posts;
create policy "users create their posts" on public.posts
  for insert
  with check (((auth.role() = 'authenticated'::text) AND (author_id = auth.uid())));

drop policy if exists "users can insert their own profile" on public.profiles;
create policy "users can insert their own profile" on public.profiles
  for insert
  with check ((auth.uid() = id));

drop policy if exists "users can read their own profile" on public.profiles;
create policy "users can read their own profile" on public.profiles
  for select
  using (((auth.uid() = id) OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile" on public.profiles
  for update
  using ((auth.uid() = id))
  with check ((auth.uid() = id));

drop policy if exists "users create their subscriptions" on public.push_subscriptions;
create policy "users create their subscriptions" on public.push_subscriptions
  for insert
  with check (((auth.role() = 'authenticated'::text) AND (profile_id = auth.uid())));

drop policy if exists "users delete their subscriptions" on public.push_subscriptions;
create policy "users delete their subscriptions" on public.push_subscriptions
  for delete
  using (((profile_id = auth.uid()) OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));

drop policy if exists "users read their subscriptions" on public.push_subscriptions;
create policy "users read their subscriptions" on public.push_subscriptions
  for select
  using (((profile_id = auth.uid()) OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));

drop policy if exists "waitlist_delete_admin" on public.waitlist;
create policy "waitlist_delete_admin" on public.waitlist
  for delete
  to authenticated
  using ((COALESCE(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text));

drop policy if exists "waitlist_insert_public" on public.waitlist;
create policy "waitlist_insert_public" on public.waitlist
  for insert
  to anon,authenticated
  with check ((((char_length(nombre) >= 2) AND (char_length(nombre) <= 60)) AND ((char_length(telefono) >= 6) AND (char_length(telefono) <= 25)) AND (COALESCE(char_length(marca), 0) <= 80) AND (COALESCE(tipo, 'rider'::text) = ANY (ARRAY['rider'::text, 'marca'::text]))));

drop policy if exists "waitlist_select_admin" on public.waitlist;
create policy "waitlist_select_admin" on public.waitlist
  for select
  to authenticated
  using ((COALESCE(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text));

drop policy if exists "waitlist_settings_admin" on public.waitlist_settings;
create policy "waitlist_settings_admin" on public.waitlist_settings
  for all
  to authenticated
  using ((COALESCE(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text))
  with check ((COALESCE(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text));

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
  using (seller_id = auth.uid());

-- Publicar: solo como uno mismo, nace pendiente y sin vender
drop policy if exists "sellers create listings" on public.listings;
create policy "sellers create listings" on public.listings
  for insert
  with check (auth.role() = 'authenticated'::text and seller_id = auth.uid() and status = 'pending'::spotra_status and sold = false);

-- Eliminar: el vendedor o el admin
drop policy if exists "seller or admin deletes listings" on public.listings;
create policy "seller or admin deletes listings" on public.listings
  for delete
  using (seller_id = auth.uid() or coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text);

-- Moderación: el admin ve y edita todo (aprobar / rechazar)
drop policy if exists "admins manage listings" on public.listings;
create policy "admins manage listings" on public.listings
  for all
  using (coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text)
  with check (coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text);

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
