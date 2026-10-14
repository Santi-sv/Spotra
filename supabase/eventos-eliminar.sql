-- SPOTRA · El organizador puede eliminar su propio evento (13/10/2026)
-- Correr UNA vez en Supabase › SQL Editor. Es seguro correrlo de nuevo.
-- Borra el evento solo si quien lo pide es su organizador. Con el evento se borran
-- (por ON DELETE CASCADE) sus inscripciones, resultados e interesados.
-- Los admins ya podían borrar eventos (política events_delete); eso no cambia.

create or replace function public.organizer_delete_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'no autorizado';
  end if;
  delete from public.events
  where id = p_event_id
    and organizer_id = auth.uid();
  if not found then
    raise exception 'no autorizado';
  end if;
end $$;

revoke all on function public.organizer_delete_event(uuid) from public, anon;
grant execute on function public.organizer_delete_event(uuid) to authenticated;

-- Comprobación: tiene que devolver una fila con "true | false"
-- (los usuarios con sesión pueden usarla; los visitantes sin sesión no).
select has_function_privilege('authenticated', 'public.organizer_delete_event(uuid)', 'execute') as con_sesion,
       has_function_privilege('anon', 'public.organizer_delete_event(uuid)', 'execute') as sin_sesion;
