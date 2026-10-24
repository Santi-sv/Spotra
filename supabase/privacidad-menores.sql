-- =====================================================================
-- SPOTRA · Privacidad de menores (24/10/2026)
-- Decisiones de Santiago:
--   · Seguir a un menor (13–17) = SOLICITUD que el menor acepta. Las cuentas sin fecha de nacimiento
--     no pueden usar la app hasta cargarla; si cargan una fecha de menor, sus seguidores pasan a solicitud.
--   · Las sesiones de un menor las ven solo sus seguidores aceptados (y su responsable).
--   · Un menor que se suma a una sesión ajena solo lo ven sus seguidores aceptados.
--   · Perfil de un menor para extraños: sin nombre completo, ciudad, bio ni redes.
--   · Inscripciones a eventos: las ve solo el organizador y el propio inscripto.
--   · Borrar cuenta: también borra el teléfono de los eventos que organizó.
-- Ejecutar UNA vez en Supabase → SQL Editor. Es re-ejecutable.
-- La consulta del final tiene que dar todo en ✅.
-- =====================================================================

-- ---------- 1) ¿Cuenta protegida? (menor de 18) ----------
create or replace function public.spotra_protected(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.birth_date > (current_date - interval '18 years')::date
                   from public.profiles p where p.id = uid), false);
$$;
revoke all on function public.spotra_protected(uuid) from public, anon;
grant execute on function public.spotra_protected(uuid) to authenticated;

-- ¿Es el responsable activo de este menor?
create or replace function public.spotra_is_guardian_of(p_minor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.guardian_links g
                  where g.minor_id = p_minor and g.guardian_id = auth.uid() and g.status = 'active');
$$;
revoke all on function public.spotra_is_guardian_of(uuid) from public, anon;
grant execute on function public.spotra_is_guardian_of(uuid) to authenticated;

-- ¿El usuario actual puede ver los datos de este rider? (él mismo, adulto, seguidor aceptado o responsable)
create or replace function public.spotra_can_see(p_rider uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_rider is not null and auth.uid() is not null and (
         p_rider = auth.uid()
      or not public.spotra_protected(p_rider)
      or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followed_id = p_rider)
      or public.spotra_is_guardian_of(p_rider));
$$;
revoke all on function public.spotra_can_see(uuid) from public, anon;
grant execute on function public.spotra_can_see(uuid) to authenticated;


-- ---------- 2) Solicitudes para seguir ----------
create table if not exists public.follow_requests (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  requester_name text,
  created_at timestamptz not null default now(),
  primary key (requester_id, target_id),
  constraint follow_requests_not_self check (requester_id <> target_id)
);
create index if not exists follow_requests_target_idx on public.follow_requests (target_id, created_at desc);

alter table public.follow_requests enable row level security;
revoke all on table public.follow_requests from anon;
revoke insert, update on table public.follow_requests from authenticated;
grant select, delete on table public.follow_requests to authenticated;

-- cada uno ve las que mandó y las que recibió; cualquiera de los dos la puede borrar (cancelar / rechazar)
drop policy if exists "follow_requests_select_own" on public.follow_requests;
create policy "follow_requests_select_own" on public.follow_requests
  for select using (requester_id = (select auth.uid()) or target_id = (select auth.uid()));
drop policy if exists "follow_requests_delete_own" on public.follow_requests;
create policy "follow_requests_delete_own" on public.follow_requests
  for delete using (requester_id = (select auth.uid()) or target_id = (select auth.uid()));

-- Nuevos tipos de aviso en la campana
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow','like','comment','session_join','spot_approved','follow_request','follow_accept'));

-- Al seguir: si la cuenta está protegida, se crea una solicitud en vez del seguimiento.
create or replace function public.follows_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_count int; v_name text;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;

  -- a) El menor acepta una solicitud (lo hace la función respond_follow_request)
  if new.followed_id = auth.uid()
     and exists (select 1 from public.follow_requests r
                  where r.requester_id = new.follower_id and r.target_id = auth.uid()) then
    delete from public.follow_requests r where r.requester_id = new.follower_id and r.target_id = auth.uid();
    new.created_at := now();
    select coalesce(p.username, split_part(p.full_name, ' ', 1)) into new.follower_name from public.profiles p where p.id = new.follower_id;
    select coalesce(p.username, split_part(p.full_name, ' ', 1)) into new.followed_name from public.profiles p where p.id = new.followed_id;
    return new;
  end if;

  -- b) Seguir normal
  new.follower_id := auth.uid();
  new.created_at := now();
  if new.followed_id = auth.uid() then raise exception 'No podés seguirte a vos mismo.'; end if;
  if exists (select 1 from public.blocks b
              where (b.blocker_id = auth.uid() and b.blocked_id = new.followed_id)
                 or (b.blocker_id = new.followed_id and b.blocked_id = auth.uid())) then
    raise exception 'No podés seguir a este rider.';
  end if;
  select count(*) into v_count from public.follows f
    where f.follower_id = auth.uid() and f.created_at > now() - interval '1 day';
  if v_count >= 200 then raise exception 'Llegaste al límite de riders seguidos por hoy.'; end if;
  select coalesce(p.username, split_part(p.full_name, ' ', 1)) into new.follower_name from public.profiles p where p.id = auth.uid();
  select coalesce(p.username, split_part(p.full_name, ' ', 1)) into new.followed_name from public.profiles p where p.id = new.followed_id;
  if new.followed_name is null then raise exception 'Ese rider no existe.'; end if;

  -- c) Cuenta protegida: solicitud (salvo su responsable)
  if public.spotra_protected(new.followed_id) and not public.spotra_is_guardian_of(new.followed_id) then
    select count(*) into v_count from public.follow_requests r
      where r.requester_id = auth.uid() and r.created_at > now() - interval '1 day';
    if v_count >= 50 then raise exception 'Llegaste al límite de solicitudes por hoy.'; end if;
    insert into public.follow_requests (requester_id, target_id, requester_name)
      values (auth.uid(), new.followed_id, new.follower_name)
      on conflict (requester_id, target_id) do nothing;
    perform public.notify_user(new.followed_id, 'follow_request', auth.uid(), null, null);
    return null;   -- no se crea el seguimiento todavía
  end if;
  return new;
end;
$$;
revoke all on function public.follows_before_insert() from public, anon, authenticated;

drop trigger if exists follows_before_insert on public.follows;
create trigger follows_before_insert
  before insert on public.follows
  for each row execute function public.follows_before_insert();

-- Aviso al seguir: si lo aceptó el menor, el aviso es para quien pidió seguirlo.
create or replace function public.trg_notify_follow() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.followed_id = auth.uid() then
    perform public.notify_user(new.follower_id, 'follow_accept', new.followed_id, null, null);
  else
    perform public.notify_user(new.followed_id, 'follow', new.follower_id, null, null);
  end if;
  return new;
end; $$;
revoke all on function public.trg_notify_follow() from public, anon, authenticated;

-- Seguir (devuelve 'following' o 'requested')
create or replace function public.follow_rider(p_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  insert into public.follows (followed_id) values (p_id) on conflict do nothing;
  if exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followed_id = p_id) then return 'following'; end if;
  if exists (select 1 from public.follow_requests r where r.requester_id = auth.uid() and r.target_id = p_id) then return 'requested'; end if;
  return 'none';
end;
$$;
revoke all on function public.follow_rider(uuid) from public, anon;
grant execute on function public.follow_rider(uuid) to authenticated;

-- Aceptar o rechazar una solicitud (solo quien la recibió)
create or replace function public.respond_follow_request(p_requester uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Tenés que iniciar sesión.'; end if;
  if not exists (select 1 from public.follow_requests r where r.requester_id = p_requester and r.target_id = v_uid) then
    return 'none';
  end if;
  if p_accept then
    insert into public.follows (follower_id, followed_id) values (p_requester, v_uid) on conflict do nothing;
    delete from public.follow_requests r where r.requester_id = p_requester and r.target_id = v_uid;
    delete from public.notifications n where n.profile_id = v_uid and n.kind = 'follow_request' and n.actor_id = p_requester;
    return 'accepted';
  end if;
  delete from public.follow_requests r where r.requester_id = p_requester and r.target_id = v_uid;
  delete from public.notifications n where n.profile_id = v_uid and n.kind = 'follow_request' and n.actor_id = p_requester;
  return 'rejected';
end;
$$;
revoke all on function public.respond_follow_request(uuid, boolean) from public, anon;
grant execute on function public.respond_follow_request(uuid, boolean) to authenticated;

-- Solicitudes recibidas (con foto), para la lista de Seguidores
create or replace function public.follow_requests_list()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(json_agg(json_build_object(
           'id', p.id, 'username', coalesce(p.username, split_part(p.full_name, ' ', 1)),
           'avatar_url', p.avatar_url, 'verified', p.verified, 'created_at', r.created_at)
         order by r.created_at desc), '[]'::json)
  from public.follow_requests r
  join public.profiles p on p.id = r.requester_id
  where r.target_id = auth.uid();
$$;
revoke all on function public.follow_requests_list() from public, anon;
grant execute on function public.follow_requests_list() to authenticated;

-- Pasa a solicitud los seguidores que ya tenía un menor (el menor decide). Su responsable se mantiene.
create or replace function public.spotra_follows_to_requests(p_minor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_n int;
begin
  if not public.spotra_protected(p_minor) then return 0; end if;
  insert into public.follow_requests (requester_id, target_id, requester_name, created_at)
  select f.follower_id, f.followed_id, f.follower_name, f.created_at
    from public.follows f
   where f.followed_id = p_minor
     and not exists (select 1 from public.guardian_links g
                      where g.minor_id = p_minor and g.guardian_id = f.follower_id and g.status = 'active')
  on conflict (requester_id, target_id) do nothing;

  insert into public.notifications (profile_id, kind, actor_id, actor_name, actor_avatar)
  select r.target_id, 'follow_request', r.requester_id, coalesce(p.username, split_part(p.full_name, ' ', 1)), p.avatar_url
    from public.follow_requests r
    join public.profiles p on p.id = r.requester_id
   where r.target_id = p_minor
     and not exists (select 1 from public.notifications n
                      where n.profile_id = r.target_id and n.kind = 'follow_request' and n.actor_id = r.requester_id);

  delete from public.follows f
   using public.follow_requests r
   where f.followed_id = p_minor and r.requester_id = f.follower_id and r.target_id = f.followed_id;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.spotra_follows_to_requests(uuid) from public, anon, authenticated;

-- Cuando una cuenta carga su fecha y resulta menor, lo mismo.
create or replace function public.profiles_minor_follows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.birth_date is distinct from old.birth_date and public.spotra_protected(new.id) then
    perform public.spotra_follows_to_requests(new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.profiles_minor_follows() from public, anon, authenticated;
drop trigger if exists profiles_minor_follows on public.profiles;
create trigger profiles_minor_follows
  after update of birth_date on public.profiles
  for each row execute function public.profiles_minor_follows();

-- Menores que ya existen (solo la primera vez: si se vuelve a correr el archivo, no deshace lo que ya aceptaron)
do $m$
begin
  if coalesce(obj_description('public.follow_requests'::regclass, 'pg_class'), '') <> 'migrado 24/10/2026' then
    perform public.spotra_follows_to_requests(p.id)
       from public.profiles p
      where public.spotra_protected(p.id)
        and exists (select 1 from public.follows f where f.followed_id = p.id);
    comment on table public.follow_requests is 'migrado 24/10/2026';
  end if;
end
$m$;


-- ---------- 3) Sesiones ----------
drop policy if exists "sessions_select" on public.sessions;
create policy "sessions_select" on public.sessions
  for select using (
    ((select auth.role()) = 'authenticated' and ends_at > now() and public.spotra_can_see(created_by))
    or (select public.is_admin()));

drop policy if exists "session_participants_select" on public.session_participants;
create policy "session_participants_select" on public.session_participants
  for select using (
    ((select auth.role()) = 'authenticated'
      and exists (select 1 from public.sessions s where s.id = session_id and s.ends_at > now())
      and public.spotra_can_see(profile_id))
    or (select public.is_admin()));

-- Aviso "se sumó a tu sesión": si es un menor, solo si el organizador lo puede ver.
create or replace function public.trg_notify_session_join() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_place text;
begin
  select s.created_by, pl.name into v_owner, v_place from public.sessions s join public.places pl on pl.id = s.place_id where s.id = new.session_id;
  if public.spotra_protected(new.profile_id)
     and not exists (select 1 from public.follows f where f.follower_id = v_owner and f.followed_id = new.profile_id)
     and not exists (select 1 from public.guardian_links g where g.minor_id = new.profile_id and g.guardian_id = v_owner and g.status = 'active') then
    return new;
  end if;
  perform public.notify_user(v_owner, 'session_join', new.profile_id, new.session_id::text, v_place); return new;
end; $$;
revoke all on function public.trg_notify_session_join() from public, anon, authenticated;


-- ---------- 4) Perfil de rider: datos personales solo para quien puede verlos ----------
create or replace function public.rider_profile(p_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.profiles%rowtype;
  v_uid uuid := auth.uid();
  v_now json;
  v_see boolean;
  v_state text := 'none';
begin
  if v_uid is null then return null; end if;
  if exists (select 1 from public.blocks b
             where (b.blocker_id = v_uid and b.blocked_id = p_id)
                or (b.blocker_id = p_id and b.blocked_id = v_uid)) then
    return null;
  end if;
  select * into r from public.profiles p where p.id = p_id;
  if not found then return null; end if;

  v_see := public.spotra_can_see(r.id);
  if exists (select 1 from public.follows f where f.follower_id = v_uid and f.followed_id = r.id) then v_state := 'following';
  elsif exists (select 1 from public.follow_requests q where q.requester_id = v_uid and q.target_id = r.id) then v_state := 'requested';
  end if;

  if r.id <> v_uid
     and r.presence_visible
     and r.birth_date is not null
     and r.birth_date <= (current_date - interval '18 years')::date
     and exists (select 1 from public.follows f where f.follower_id = v_uid and f.followed_id = r.id) then
    select json_build_object('place_id', pl.id, 'name', pl.name) into v_now
    from public.places pl
    where pl.id = coalesce(
      (select rp.place_id from public.rider_presence rp
        where rp.profile_id = r.id and rp.expires_at > now() limit 1),
      (select s.place_id from public.sessions s
        where s.created_by = r.id and s.starts_at <= now() and s.ends_at > now()
        order by s.starts_at desc limit 1),
      (select s.place_id from public.session_participants sp
        join public.sessions s on s.id = sp.session_id
        where sp.profile_id = r.id and s.starts_at <= now() and s.ends_at > now()
        order by s.starts_at desc limit 1))
    limit 1;
  end if;

  return json_build_object(
    'id', r.id,
    'username', r.username,
    'name', case when v_see then r.full_name end,
    'avatar_url', r.avatar_url,
    'cover_url', r.cover_url,
    'bio', case when v_see then r.bio end,
    'discipline', r.discipline,
    'country_code', r.country_code,
    'city', case when v_see then r.city end,
    'instagram', case when v_see then r.instagram end,
    'tiktok', case when v_see then r.tiktok end,
    'facebook', case when v_see then r.facebook end,
    'verified', r.verified,
    'followers', (select count(*) from public.follows f where f.followed_id = r.id),
    'following', (select count(*) from public.follows f where f.follower_id = r.id),
    'posts', (select count(*) from public.posts po where po.author_id = r.id),
    'now', v_now,
    'protected', r.id <> v_uid and public.spotra_protected(r.id),
    'follow_state', v_state,
    'is_me', r.id = v_uid);
end;
$$;
revoke all on function public.rider_profile(uuid) from public, anon;
grant execute on function public.rider_profile(uuid) to authenticated;


-- ---------- 5) Inscripciones a eventos ----------
-- (función aparte: si la regla leyera events directo, se cruzaría con la regla de events que lee inscripciones)
create or replace function public.spotra_is_event_organizer(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.events e where e.id = p_event and e.organizer_id = auth.uid());
$$;
revoke all on function public.spotra_is_event_organizer(uuid) from public;
grant execute on function public.spotra_is_event_organizer(uuid) to anon, authenticated;

drop policy if exists "event_registrations_select" on public.event_registrations;
create policy "event_registrations_select" on public.event_registrations
  for select using (
    profile_id = (select auth.uid())
    or public.spotra_is_event_organizer(event_id)
    or (select public.is_admin()));

-- Cantidad de inscriptos (solo el número), como columna calculada: events?select=...,reg_count
create or replace function public.reg_count(public.events)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.event_registrations r where r.event_id = $1.id;
$$;
revoke all on function public.reg_count(public.events) from public;
grant execute on function public.reg_count(public.events) to anon, authenticated;


-- ---------- 6) Borrar cuenta: también el teléfono de sus eventos ----------
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
  delete from auth.users where id = v_uid;
end $function$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;


-- ---------- Comprobación (tiene que dar todo ✅) ----------
select 'Tabla de solicitudes' as prueba,
       case when to_regclass('public.follow_requests') is not null then '✅' else '❌' end as resultado
union all
select 'Seguidores de menores pasados a solicitud',
       case when obj_description('public.follow_requests'::regclass, 'pg_class') = 'migrado 24/10/2026' then '✅' else '❌' end
union all
select 'Aviso al cargar fecha de menor',
       case when exists (select 1 from pg_trigger where tgname = 'profiles_minor_follows') then '✅' else '❌' end
union all
select 'Regla de sesiones nueva',
       case when (select qual from pg_policies where tablename = 'sessions' and policyname = 'sessions_select') like '%spotra_can_see%' then '✅' else '❌' end
union all
select 'Regla de participantes nueva',
       case when (select qual from pg_policies where tablename = 'session_participants' and policyname = 'session_participants_select') like '%spotra_can_see%' then '✅' else '❌' end
union all
select 'Regla de inscripciones nueva',
       case when (select qual from pg_policies where tablename = 'event_registrations' and policyname = 'event_registrations_select') like '%spotra_is_event_organizer%' then '✅' else '❌' end
union all
select 'Contador de inscriptos',
       case when to_regprocedure('public.reg_count(public.events)') is not null then '✅' else '❌' end
union all
select 'Perfil con follow_state',
       case when (select prosrc from pg_proc where proname = 'rider_profile') like '%follow_state%' then '✅' else '❌' end
union all
select 'Borrar cuenta limpia el teléfono',
       case when (select prosrc from pg_proc where proname = 'delete_my_account') like '%contact_phone = null%' then '✅' else '❌' end
union all
select 'Solicitudes pendientes (dato)', (select count(*)::text from public.follow_requests);
