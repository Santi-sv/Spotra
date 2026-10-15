-- SPOTRA · El WhatsApp de los vendedores del market solo lo ven usuarios con sesión (15/10/2026)
-- Antes cualquiera sin cuenta (incluidos robots) podía leer los números. Es seguro correrlo de nuevo.
-- Los visitantes sin sesión siguen viendo los productos, pero no la columna whatsapp.

revoke select on public.listings from anon;
grant select (id, seller_id, username, title, description, category, condition, price, currency,
              city, latitude, longitude, photos, status, sold, created_at, updated_at,
              previous_price, price_dropped_at)
  on public.listings to anon;

-- Comprobación: tiene que devolver "false | true | true"
select has_column_privilege('anon', 'public.listings', 'whatsapp', 'select')          as sin_sesion_ve_whatsapp,
       has_column_privilege('anon', 'public.listings', 'title', 'select')             as sin_sesion_ve_productos,
       has_column_privilege('authenticated', 'public.listings', 'whatsapp', 'select') as con_sesion_ve_whatsapp;
