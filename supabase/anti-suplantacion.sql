-- =====================================================================
-- SPOTRA · Anti-suplantación y límites (24/10/2026) — sesión 4 de la auditoría
--   · El autor, el nombre de usuario, la foto y la fecha los pone el SERVIDOR (desde profiles),
--     nunca el celular: posts, comentarios, me gusta, productos, inscripciones, eventos y spots.
--   · Largos máximos en los textos.
--   · Límites de frecuencia contra bots (el admin desbloqueado no tiene límite).
--   · Nombres reservados: nadie puede llamarse "spotra", "admin", "soporte", etc.
--   · El teléfono del organizador de un evento solo lo ven usuarios con cuenta (tabla aparte event_private).
-- Ejecutar UNA vez en Supabase → SQL Editor. Es re-ejecutable.
-- La consulta del final tiene que dar todo en ✅.
-- =====================================================================

-- ---------- Ayudantes ----------
-- Nombre público del usuario (el mismo que se usa en todo SPOTRA)
create or replace function public.spotra_public_name(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p.username, split_part(p.full_name, ' ', 1)) from public.profiles p where p.id = p_uid;
$$;
revoke all on function public.spotra_public_name(uuid) from public, anon, authenticated;

-- Texto demasiado largo → error claro
create or replace function public.spotra_max_len(p_value text, p_max int, p_label text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is not null and char_length(p_value) > p_max then
    raise exception '%: máximo % caracteres.', p_label, p_max;
  end if;
end;
$$;
revoke all on function public.spotra_max_len(text, int, text) from public, anon, authenticated;

-- Nombres reservados para cuentas oficiales
create or replace function public.spotra_reserved_name(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_value is not null
     and lower(translate(p_value, '0134@$ _-.', 'oieaas')) ~ '(spotra|admin|soporte|support|moderador|moderator|oficial|official)';
$$;
revoke all on function public.spotra_reserved_name(text) from public, anon, authenticated;


-- ---------- 1) Foro: publicaciones ----------
create or replace function public.posts_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_n int;
begin
  -- SQL Editor / service_role (tareas del admin): sin reglas de usuario
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then return new; end if;
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  if not public.is_admin() then
    new.author_id := auth.uid();
    select count(*) into v_n from public.posts p where p.author_id = auth.uid() and p.created_at > now() - interval '1 hour';
    if v_n >= 10 then raise exception 'Publicaste mucho en poco tiempo. Probá de nuevo en un rato.'; end if;
    select count(*) into v_n from public.posts p where p.author_id = auth.uid() and p.created_at > now() - interval '1 day';
    if v_n >= 30 then raise exception 'Llegaste al límite de publicaciones por hoy.'; end if;
  end if;
  new.username := public.spotra_public_name(new.author_id);
  new.avatar_url := (select p.avatar_url from public.profiles p where p.id = new.author_id);
  new.created_at := now();
  perform public.spotra_max_len(new.content, 2000, 'La publicación');
  return new;
end;
$$;
revoke all on function public.posts_before_insert() from public, anon, authenticated;
drop trigger if exists posts_before_insert on public.posts;
create trigger posts_before_insert before insert on public.posts
  for each row execute function public.posts_before_insert();

-- ---------- 2) Foro: comentarios ----------
create or replace function public.post_comments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_n int;
begin
  -- SQL Editor / service_role (tareas del admin): sin reglas de usuario
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then return new; end if;
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  if not public.is_admin() then
    new.author_id := auth.uid();
    select count(*) into v_n from public.post_comments c where c.author_id = auth.uid() and c.created_at > now() - interval '1 hour';
    if v_n >= 30 then raise exception 'Comentaste mucho en poco tiempo. Probá de nuevo en un rato.'; end if;
  end if;
  new.username := public.spotra_public_name(new.author_id);
  new.created_at := now();
  perform public.spotra_max_len(new.content, 500, 'El comentario');
  return new;
end;
$$;
revoke all on function public.post_comments_before_insert() from public, anon, authenticated;
drop trigger if exists post_comments_before_insert on public.post_comments;
create trigger post_comments_before_insert before insert on public.post_comments
  for each row execute function public.post_comments_before_insert();

-- ---------- 3) Foro: me gusta ----------
create or replace function public.post_likes_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_n int;
begin
  -- SQL Editor / service_role (tareas del admin): sin reglas de usuario
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then return new; end if;
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  new.profile_id := auth.uid();
  new.created_at := now();
  select count(*) into v_n from public.post_likes l where l.profile_id = auth.uid() and l.created_at > now() - interval '1 hour';
  if v_n >= 300 then raise exception 'Demasiados me gusta en poco tiempo. Probá de nuevo en un rato.'; end if;
  return new;
end;
$$;
revoke all on function public.post_likes_before_insert() from public, anon, authenticated;
drop trigger if exists post_likes_before_insert on public.post_likes;
create trigger post_likes_before_insert before insert on public.post_likes
  for each row execute function public.post_likes_before_insert();

-- ---------- 4) Market: productos ----------
create or replace function public.listings_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_n int;
begin
  -- SQL Editor / service_role (tareas del admin): sin reglas de usuario
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then return new; end if;
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  if not public.is_admin() then
    new.seller_id := auth.uid();
    select count(*) into v_n from public.listings l where l.seller_id = auth.uid() and l.created_at > now() - interval '1 day';
    if v_n >= 10 then raise exception 'Llegaste al límite de productos por hoy.'; end if;
  end if;
  new.username := public.spotra_public_name(new.seller_id);
  new.created_at := now();
  new.updated_at := now();
  perform public.spotra_max_len(new.city, 80, 'La ciudad');
  return new;
end;
$$;
revoke all on function public.listings_before_insert() from public, anon, authenticated;
drop trigger if exists listings_before_insert on public.listings;
create trigger listings_before_insert before insert on public.listings
  for each row execute function public.listings_before_insert();

-- ---------- 5) Eventos: inscripciones ----------
create or replace function public.event_registrations_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- SQL Editor / service_role (tareas del admin): sin reglas de usuario
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then return new; end if;
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  if not public.is_admin() then new.profile_id := auth.uid(); end if;
  new.username := public.spotra_public_name(new.profile_id);
  new.created_at := now();
  if cardinality(new.categories) > 10 then raise exception 'Demasiadas categorías.'; end if;
  return new;
end;
$$;
revoke all on function public.event_registrations_before_insert() from public, anon, authenticated;
drop trigger if exists event_registrations_before_insert on public.event_registrations;
create trigger event_registrations_before_insert before insert on public.event_registrations
  for each row execute function public.event_registrations_before_insert();

-- ---------- 6) Eventos: crear y editar ----------
create or replace function public.events_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_n int;
begin
  -- SQL Editor / service_role (tareas del admin): sin reglas de usuario
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
    if not public.is_admin() then
      new.organizer_id := auth.uid();
      select count(*) into v_n from public.events e where e.organizer_id = auth.uid() and e.created_at > now() - interval '1 day';
      if v_n >= 5 then raise exception 'Llegaste al límite de eventos por hoy.'; end if;
    end if;
    new.created_at := now();
  end if;
  new.updated_at := now();
  if tg_op = 'INSERT' or new.title is distinct from old.title then perform public.spotra_max_len(new.title, 120, 'El título'); end if;
  if tg_op = 'INSERT' or new.description is distinct from old.description then perform public.spotra_max_len(new.description, 3000, 'La descripción'); end if;
  if tg_op = 'INSERT' or new.registration_info is distinct from old.registration_info then perform public.spotra_max_len(new.registration_info, 1000, 'La info de inscripción'); end if;
  if tg_op = 'INSERT' or new.prizes is distinct from old.prizes then perform public.spotra_max_len(new.prizes, 1000, 'Los premios'); end if;
  if cardinality(new.categories) > 20 then raise exception 'Demasiadas categorías.'; end if;
  return new;
end;
$$;
revoke all on function public.events_before_write() from public, anon, authenticated;
drop trigger if exists events_before_write on public.events;
create trigger events_before_write before insert or update on public.events
  for each row execute function public.events_before_write();

-- ---------- 7) Spots propuestos y fotos de spots ----------
create or replace function public.place_submissions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_n int;
begin
  -- SQL Editor / service_role (tareas del admin): sin reglas de usuario
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then return new; end if;
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  if not public.is_admin() then
    new.submitted_by := auth.uid();
    select count(*) into v_n from public.place_submissions s where s.submitted_by = auth.uid() and s.created_at > now() - interval '1 day';
    if v_n >= 20 then raise exception 'Llegaste al límite de spots propuestos por hoy.'; end if;
  end if;
  new.created_at := now();
  perform public.spotra_max_len(new.name, 120, 'El nombre');
  perform public.spotra_max_len(new.description, 1000, 'La descripción');
  perform public.spotra_max_len(new.address, 200, 'La dirección');
  perform public.spotra_max_len(new.city, 80, 'La ciudad');
  perform public.spotra_max_len(new.contact_phone, 30, 'El teléfono');
  perform public.spotra_max_len(new.website, 200, 'La web');
  perform public.spotra_max_len(new.instagram, 100, 'El Instagram');
  if new.google_payload is not null and octet_length(new.google_payload::text) > 20000 then new.google_payload := null; end if;
  return new;
end;
$$;
revoke all on function public.place_submissions_before_insert() from public, anon, authenticated;
drop trigger if exists place_submissions_before_insert on public.place_submissions;
create trigger place_submissions_before_insert before insert on public.place_submissions
  for each row execute function public.place_submissions_before_insert();

create or replace function public.place_photos_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_n int;
begin
  -- SQL Editor / service_role (tareas del admin): sin reglas de usuario
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then return new; end if;
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  if not public.is_admin() then
    new.uploaded_by := auth.uid();
    select count(*) into v_n from public.place_photos f where f.uploaded_by = auth.uid() and f.created_at > now() - interval '1 day';
    if v_n >= 30 then raise exception 'Llegaste al límite de fotos por hoy.'; end if;
  end if;
  new.created_at := now();
  return new;
end;
$$;
revoke all on function public.place_photos_before_insert() from public, anon, authenticated;
drop trigger if exists place_photos_before_insert on public.place_photos;
create trigger place_photos_before_insert before insert on public.place_photos
  for each row execute function public.place_photos_before_insert();

-- ---------- 8) Perfil: largos y nombres reservados ----------
create or replace function public.profiles_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- SQL Editor / service_role (tareas del admin): sin reglas de usuario
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' or new.username is distinct from old.username then
    perform public.spotra_max_len(new.username, 30, 'El nombre de usuario');
    if public.spotra_reserved_name(new.username) and not public.is_admin() then
      raise exception 'Ese nombre de usuario está reservado. Elegí otro.';
    end if;
  end if;
  if tg_op = 'INSERT' or new.full_name is distinct from old.full_name then
    perform public.spotra_max_len(new.full_name, 80, 'El nombre');
    if public.spotra_reserved_name(new.full_name) and not public.is_admin() then
      raise exception 'Ese nombre está reservado. Elegí otro.';
    end if;
  end if;
  if tg_op = 'INSERT' or new.bio is distinct from old.bio then perform public.spotra_max_len(new.bio, 300, 'La bio'); end if;
  if tg_op = 'INSERT' or new.city is distinct from old.city then perform public.spotra_max_len(new.city, 80, 'La ciudad'); end if;
  if tg_op = 'INSERT' or new.instagram is distinct from old.instagram then perform public.spotra_max_len(new.instagram, 120, 'El Instagram'); end if;
  if tg_op = 'INSERT' or new.tiktok is distinct from old.tiktok then perform public.spotra_max_len(new.tiktok, 120, 'El TikTok'); end if;
  if tg_op = 'INSERT' or new.facebook is distinct from old.facebook then perform public.spotra_max_len(new.facebook, 120, 'El Facebook'); end if;
  if tg_op = 'INSERT' or new.phone is distinct from old.phone then perform public.spotra_max_len(new.phone, 30, 'El celular'); end if;
  return new;
end;
$$;
revoke all on function public.profiles_limits() from public, anon, authenticated;
drop trigger if exists profiles_limits on public.profiles;
create trigger profiles_limits before insert or update on public.profiles
  for each row execute function public.profiles_limits();


-- ---------- 9) Teléfono del organizador: solo con cuenta ----------
-- El teléfono pasa a una tabla cerrada (event_private). En events la columna queda siempre vacía,
-- así los visitantes no lo pueden leer. La app lo pide como "event_contact" (solo con cuenta).
create table if not exists public.event_private (
  event_id uuid primary key references public.events(id) on delete cascade deferrable initially deferred,
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 30),
  updated_at timestamptz not null default now()
);
alter table public.event_private enable row level security;
revoke all on table public.event_private from anon, authenticated;

create or replace function public.event_private_set(p_event uuid, p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.event_private (event_id, contact_phone, updated_at)
  values (p_event, nullif(trim(coalesce(p_phone, '')), ''), now())
  on conflict (event_id) do update set contact_phone = excluded.contact_phone, updated_at = now();
end;
$$;
revoke all on function public.event_private_set(uuid, text) from public, anon, authenticated;

-- Al crear o editar un evento: el teléfono se guarda aparte y la columna pública queda vacía.
create or replace function public.events_phone_private()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.contact_phone is not null then
    perform public.spotra_max_len(new.contact_phone, 30, 'El teléfono');
    perform public.event_private_set(new.id, new.contact_phone);
    new.contact_phone := null;
  end if;
  return new;
end;
$$;
revoke all on function public.events_phone_private() from public, anon, authenticated;
drop trigger if exists events_phone_private on public.events;
create trigger events_phone_private before insert or update on public.events
  for each row execute function public.events_phone_private();

-- Teléfonos que ya existen
insert into public.event_private (event_id, contact_phone)
select e.id, e.contact_phone from public.events e where e.contact_phone is not null
on conflict (event_id) do update set contact_phone = excluded.contact_phone, updated_at = now();
update public.events set contact_phone = null where contact_phone is not null;

-- Lo que lee la app (columna calculada): el teléfono solo para usuarios con cuenta
create or replace function public.event_contact(public.events)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is not null
              then (select p.contact_phone from public.event_private p where p.event_id = $1.id) end;
$$;
revoke all on function public.event_contact(public.events) from public;
grant execute on function public.event_contact(public.events) to anon, authenticated;

-- Editar evento (organizador): ahora también puede borrar el teléfono
create or replace function public.organizer_update_event(p_event_id uuid, p_title text, p_starts_at timestamp with time zone, p_description text, p_discipline text, p_categories text[], p_registration_info text, p_prizes text, p_capacity integer, p_closes_at timestamp with time zone, p_contact_phone text, p_rain boolean, p_place_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
    rain_reschedule = coalesce(p_rain, false),
    place_id = coalesce(p_place_id, place_id),
    updated_at = now()
  where id = p_event_id
    and organizer_id = auth.uid()
    and status in ('pending', 'approved');
  if not found then
    raise exception 'no autorizado';
  end if;
  perform public.spotra_max_len(p_contact_phone, 30, 'El teléfono');
  perform public.event_private_set(p_event_id, p_contact_phone);
end $function$;

-- Borrar cuenta: también el teléfono guardado aparte
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
  update public.events set contact_phone = null where organizer_id = v_uid;
  delete from public.event_private p using public.events e where e.id = p.event_id and e.organizer_id = v_uid;
  delete from auth.users where id = v_uid;
end $function$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;


-- ---------- Comprobación (tiene que dar todo ✅) ----------
select 'Publicaciones: autor y nombre del servidor' as prueba,
       case when exists (select 1 from pg_trigger where tgname = 'posts_before_insert') then '✅' else '❌' end as resultado
union all select 'Comentarios: autor y nombre del servidor',
       case when exists (select 1 from pg_trigger where tgname = 'post_comments_before_insert') then '✅' else '❌' end
union all select 'Me gusta: límite y fecha',
       case when exists (select 1 from pg_trigger where tgname = 'post_likes_before_insert') then '✅' else '❌' end
union all select 'Productos: vendedor y nombre del servidor',
       case when exists (select 1 from pg_trigger where tgname = 'listings_before_insert') then '✅' else '❌' end
union all select 'Inscripciones: nombre del servidor',
       case when exists (select 1 from pg_trigger where tgname = 'event_registrations_before_insert') then '✅' else '❌' end
union all select 'Eventos: organizador, límites y largos',
       case when exists (select 1 from pg_trigger where tgname = 'events_before_write') then '✅' else '❌' end
union all select 'Spots y fotos: límites',
       case when exists (select 1 from pg_trigger where tgname = 'place_submissions_before_insert')
             and exists (select 1 from pg_trigger where tgname = 'place_photos_before_insert') then '✅' else '❌' end
union all select 'Perfil: largos y nombres reservados',
       case when exists (select 1 from pg_trigger where tgname = 'profiles_limits') then '✅' else '❌' end
union all select 'Teléfonos de eventos fuera de la tabla pública',
       case when not exists (select 1 from public.events where contact_phone is not null)
             and to_regclass('public.event_private') is not null then '✅' else '❌' end
union all select 'Contacto para usuarios con cuenta (event_contact)',
       case when to_regprocedure('public.event_contact(public.events)') is not null then '✅' else '❌' end;
