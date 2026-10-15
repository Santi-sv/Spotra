-- SPOTRA · Solo se aceptan direcciones de imagen de SPOTRA (15/10/2026)
-- Problema: varias columnas de fotos aceptaban cualquier texto. Alguien podía guardar una "foto" armada a mano
-- que, al mostrarse, tapara la pantalla de otros usuarios con lo que quisiera.
-- Solución: la base solo acepta fotos subidas a nuestro Storage (place-images) o imágenes propias de la app (assets/...).
-- Se controla solo cuando una foto se carga o cambia, así lo que ya existe no bloquea ninguna edición.
-- Es seguro correrlo de nuevo.

-- 1) Regla única para todas las fotos
create or replace function public.spotra_img_ok(u text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select u is null or u = ''
      or u ~ '^https://threviqdxzbjsdxbjubm\.supabase\.co/storage/v1/object/public/place-images/[A-Za-z0-9/_.%-]+$'
      or u ~ '^assets/[A-Za-z0-9/_.-]+$';
$$;

-- 2) Control: revisa solo las columnas de foto que se cargan o cambian
create or replace function public.spotra_check_imgs()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  arg text;
  col text;
  soft boolean;
  v jsonb;
  item text;
begin
  -- "~columna" = foto copiada del perfil: si no es válida se vacía en vez de frenar la acción
  foreach arg in array tg_argv loop
    soft := left(arg, 1) = '~';
    col := ltrim(arg, '~');
    v := to_jsonb(new) -> col;
    if tg_op = 'UPDATE' and v is not distinct from (to_jsonb(old) -> col) then
      continue;
    end if;
    if v is null or jsonb_typeof(v) = 'null' then
      continue;
    elsif jsonb_typeof(v) = 'array' then
      for item in select jsonb_array_elements_text(v) loop
        if not public.spotra_img_ok(item) then
          raise exception 'Imagen no válida.' using errcode = 'check_violation';
        end if;
      end loop;
    elsif not public.spotra_img_ok(v #>> '{}') then
      if soft then
        new := jsonb_populate_record(new, jsonb_build_object(col, null));
      else
        raise exception 'Imagen no válida.' using errcode = 'check_violation';
      end if;
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.spotra_check_imgs() from public, anon, authenticated;

-- 3) 5 spots de junio guardaron una foto rota (dirección "blob:" que solo existía en el celular de quien lo creó).
--    Nunca se vieron. Se vacían.
update public.places set image_url = null where image_url like 'blob:%';
update public.place_submissions set image_url = null where image_url like 'blob:%';

-- 4) Activar el control en cada tabla con fotos
do $$
declare r record;
begin
  for r in select * from (values
      ('profiles',             array['avatar_url','cover_url']),
      ('posts',                array['~avatar_url','image_url']),
      ('listings',             array['photos']),
      ('place_photos',         array['url']),
      ('place_submissions',    array['image_url']),
      ('places',               array['image_url']),
      ('events',               array['image_url']),
      ('sessions',             array['~avatar_url']),
      ('session_participants', array['~avatar_url']),
      ('notifications',        array['~actor_avatar'])
    ) as t(tbl, cols)
  loop
    if to_regclass('public.' || r.tbl) is not null then
      execute format('drop trigger if exists spotra_imgs_guard on public.%I', r.tbl);
      execute format('create trigger spotra_imgs_guard before insert or update on public.%I
                      for each row execute function public.spotra_check_imgs(%s)',
                     r.tbl, (select string_agg(quote_literal(c), ', ') from unnest(r.cols) c));
    end if;
  end loop;
end $$;

-- Comprobación 1: tienen que aparecer 10 tablas
select event_object_table as tabla, count(*) / 2 as controles
from information_schema.triggers
where trigger_name = 'spotra_imgs_guard' and trigger_schema = 'public'
group by 1 order by 1;
